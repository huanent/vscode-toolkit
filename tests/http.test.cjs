const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

class Range {
	constructor(startLine, startCharacter, endLine, endCharacter) {
		this.start = { line: startLine, character: startCharacter };
		this.end = { line: endLine, character: endCharacter };
	}
}

class Diagnostic {
	constructor(range, message, severity) {
		Object.assign(this, { range, message, severity });
	}
}

const vscode = { Range, Diagnostic, DiagnosticSeverity: { Error: 0 } };
const modules = new Map();
function loadModule(name) {
	if (modules.has(name)) return modules.get(name);
	const filename = path.join(__dirname, '../src/features/http', `${name}.ts`);
	const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
		compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
	}).outputText;
	const sandbox = {
		exports: {},
		URL,
		require: dependency => (dependency === 'vscode' ? vscode : loadModule(dependency)),
	};
	vm.runInNewContext(compiled, sandbox, { filename });
	modules.set(name, sandbox.exports);
	return sandbox.exports;
}

function document(text) {
	const lines = text.split(/\r?\n/);
	const offsets = [];
	let offset = 0;
	for (const line of text.matchAll(/[^\r\n]*(?:\r?\n|$)/g)) {
		offsets.push(offset);
		offset += line[0].length;
	}
	return {
		lineCount: lines.length,
		lineAt: index => ({
			text: lines[index],
			range: new Range(index, 0, index, lines[index].length),
		}),
		getText: range =>
			range
				? text.slice(
						offsets[range.start.line] + range.start.character,
						offsets[range.end.line] + range.end.character,
					)
				: text,
	};
}

const { HttpLanguageService } = loadModule('httpLanguageService');
const service = new HttpLanguageService();
const prefix =
	'### Example\nPOST https://example.invalid HTTP/1.1\nContent-Type: application/json\n\n';

test('body comments are removed without changing strings or CRLF', () => {
	const body = '{\n  "url": "https://example.invalid/#fragment",\n  "text": "# keep // keep"\n}';
	for (const ending of ['\n', '\r\n']) {
		const source = (prefix + body + '\n\n  # comment\n\t// {{undefined}}\n').replace(/\n/g, ending);
		assert.equal(service.parseRequest(document(source), 1).body, body.replace(/\n/g, ending));
	}
});

test('comment-only GET body is empty', () => {
	assert.equal(
		service.parseRequest(document('GET https://example.invalid\n\n# comment'), 0).body,
		undefined,
	);
});

test('body request lines cannot change language context', () => {
	const source = document(
		prefix +
			'GET https://body.invalid\nContent-Type: text/plain\n\nbody\n### Next\nGET https://next.invalid',
	);
	assert.equal(service.getLineContext(source, 6), 'body');
	assert.equal(service.getLineContext(source, 7), 'body');
	assert.equal(service.getLineContext(source, 9), 'request');
});

test('only pre-request definitions become file variables', () => {
	const source = document(
		'@host = https://example.invalid\n' + prefix + '@host = body\n@fake = body',
	);
	assert.equal(service.collectVariables(source).get('host'), 'https://example.invalid');
	assert.equal(service.collectVariables(source).has('fake'), false);
});

test('comment references do not cause undefined variable diagnostics', () => {
	assert.equal(
		service.getDiagnostics(document(prefix + '# {{missing}}\n// {{missing}}')).length,
		0,
	);
	assert.equal(service.getDiagnostics(document(prefix + '{"value":"{{missing}}"}')).length, 1);
});

test('nested variables resolve and cycles report useful errors', () => {
	const variables = new Map([
		['host', 'https://example.invalid'],
		['base', '{{host}}/api'],
		['cycle', '{{cycle}}'],
	]);
	assert.equal(
		service.substituteVariables('{{base}}/items', variables),
		'https://example.invalid/api/items',
	);
	assert.throws(
		() => service.substituteVariables('{{cycle}}', variables),
		/Circular HTTP variable/,
	);
	assert.throws(() => service.substituteVariables('{{missing}}', variables), /not defined/);
	assert.match(
		service.getDiagnostics(document('@cycle = {{cycle}}\nGET https://example.invalid'))[0].message,
		/Circular HTTP variable/,
	);
});

test('headers validate names and merge case-insensitively', () => {
	const request = service.parseRequest(
		document(
			'GET https://example.invalid\nAccept: text/plain\naccept: application/json\nCookie: first=1\ncookie: second=2',
		),
		0,
	);
	assert.equal(request.headers.Accept, 'text/plain, application/json');
	assert.equal(request.headers.Cookie, 'first=1; second=2');
	assert.throws(
		() => service.parseRequest(document('GET https://example.invalid\nBad Name: value'), 0),
		/header name/,
	);
});

test('transport constraints fail before sending', () => {
	for (const request of [
		'GET /relative',
		'GET file:///tmp/example',
		'GET https://user:pass@example.invalid',
		'TRACE https://example.invalid',
	]) {
		assert.throws(() => service.parseRequest(document(request), 0));
	}
	assert.equal(
		service.parseRequest(document('SEARCH https://example.invalid'), 0).method,
		'SEARCH',
	);
});

const { formatHttp } = loadModule('httpFormatter');

test('formatter preserves plain text body whitespace', () => {
	const source = 'POST https://example.invalid\nContent-Type: text/plain\n\n  content  \n \n';
	assert.equal(formatHttp(source), source);
});

test('formatter formats JSON with surrounding comments and is idempotent', () => {
	const source = prefix + '# before\n{"ok":true}\n\n// after\n';
	const formatted = formatHttp(source);
	assert.equal(formatted, prefix + '# before\n{\n  "ok": true\n}\n\n// after\n');
	assert.equal(formatHttp(formatted), formatted);
	assert.equal(
		service.parseRequest(document(formatted), 1).body,
		service.parseRequest(document(prefix + '{\n  "ok": true\n}'), 1).body,
	);
});
