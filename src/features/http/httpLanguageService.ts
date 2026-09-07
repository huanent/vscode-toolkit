import * as vscode from 'vscode';

export const HTTP_METHODS = [
	'GET',
	'HEAD',
	'POST',
	'PUT',
	'PATCH',
	'DELETE',
	'OPTIONS',
	'CONNECT',
	'TRACE',
	'PROPFIND',
	'PROPPATCH',
	'MKCOL',
	'COPY',
	'MOVE',
	'LOCK',
	'UNLOCK',
	'CHECKOUT',
	'CHECKIN',
	'REPORT',
	'MERGE',
	'MKACTIVITY',
	'MKWORKSPACE',
	'VERSION-CONTROL',
	'BASELINE-CONTROL',
	'ORDERPATCH',
	'ACL',
	'SEARCH',
	'PURGE',
	'LINK',
	'UNLINK',
	'VIEW',
	'NOTIFY',
	'SUBSCRIBE',
	'UNSUBSCRIBE',
] as const;

const methodPattern = HTTP_METHODS.join('|');
export const requestLinePattern = new RegExp(
	`^\\s*(${methodPattern})\\s+(\\S+)(?:\\s+(HTTP\\/\\d(?:\\.\\d)?))?\\s*$`,
	'i',
);
export const separatorPattern = /^\s*###(?:\s|$)/;
export const variablePattern = /^\s*@([A-Za-z_][\w.-]*)\s*=\s*(.*)$/;

export type HttpLineContext = 'request' | 'header' | 'body';

export interface ParsedRequestLine {
	method: string;
	url: string;
	version?: string;
}

export interface RequestBounds {
	start: number;
	end: number;
}

export interface ParsedHttpRequest {
	method: string;
	url: string;
	headers: Record<string, string>;
	body?: string;
	line: number;
}

export class HttpLanguageService {
	parseRequestLine(text: string): ParsedRequestLine | undefined {
		const match = requestLinePattern.exec(text);
		if (!match) {
			return undefined;
		}
		return {
			method: match[1].toUpperCase(),
			url: match[2],
			version: match[3]?.toUpperCase(),
		};
	}

	findRequestBounds(document: vscode.TextDocument, selectedLine: number): RequestBounds {
		let start = Math.min(Math.max(selectedLine, 0), document.lineCount - 1);
		if (separatorPattern.test(document.lineAt(start).text) && start + 1 < document.lineCount) {
			start++;
		}
		let end = start;
		while (start > 0 && !separatorPattern.test(document.lineAt(start - 1).text)) {
			start--;
		}
		while (end + 1 < document.lineCount && !separatorPattern.test(document.lineAt(end + 1).text)) {
			end++;
		}
		return { start, end };
	}

	collectVariables(document: vscode.TextDocument): Map<string, string> {
		const variables = new Map<string, string>();
		const contexts = this.getLineContexts(document);
		for (let line = 0; line < document.lineCount; line++) {
			if (contexts[line] !== 'request') {
				continue;
			}
			const match = variablePattern.exec(document.lineAt(line).text);
			if (match) {
				variables.set(match[1], match[2]);
			}
		}
		return variables;
	}

	getLineContext(document: vscode.TextDocument, line: number): HttpLineContext {
		return this.getLineContexts(document)[line] ?? 'request';
	}

	getLineContexts(document: vscode.TextDocument): HttpLineContext[] {
		const contexts: HttpLineContext[] = [];
		let context: HttpLineContext = 'request';
		for (let line = 0; line < document.lineCount; line++) {
			const text = document.lineAt(line).text;
			if (separatorPattern.test(text)) {
				context = 'request';
			}
			contexts.push(context);
			if (context === 'request' && this.parseRequestLine(text)) {
				context = 'header';
			} else if (context === 'header' && text.trim() === '') {
				context = 'body';
			}
		}
		return contexts;
	}

	getMethodRange(
		document: vscode.TextDocument,
		position: vscode.Position,
	): vscode.Range | undefined {
		if (this.getLineContext(document, position.line) !== 'request') {
			return undefined;
		}
		const text = document.lineAt(position.line).text;
		const match = /^(\s*)([A-Za-z-]*)/.exec(text);
		if (
			!match ||
			position.character < match[1].length ||
			position.character > match[1].length + match[2].length
		) {
			return undefined;
		}
		return new vscode.Range(
			position.line,
			match[1].length,
			position.line,
			match[1].length + match[2].length,
		);
	}

	getHeaderNameRange(
		document: vscode.TextDocument,
		position: vscode.Position,
	): vscode.Range | undefined {
		if (this.getLineContext(document, position.line) !== 'header') {
			return undefined;
		}
		const text = document.lineAt(position.line).text;
		const match = /^(\s*)([!#$%&'*+.^_`|~0-9A-Za-z-]*)/.exec(text);
		if (
			!match ||
			position.character < match[1].length ||
			position.character > match[1].length + match[2].length
		) {
			return undefined;
		}
		return new vscode.Range(
			position.line,
			match[1].length,
			position.line,
			match[1].length + match[2].length,
		);
	}

	parseRequest(document: vscode.TextDocument, selectedLine: number): ParsedHttpRequest {
		const bounds = this.findRequestBounds(document, selectedLine);
		let requestLine = -1;
		let parsedLine: ParsedRequestLine | undefined;
		for (let line = bounds.start; line <= bounds.end; line++) {
			parsedLine = this.parseRequestLine(document.lineAt(line).text);
			if (parsedLine) {
				requestLine = line;
				break;
			}
		}
		if (requestLine < 0 || !parsedLine) {
			throw new Error('No valid HTTP request found in the current request block.');
		}

		const variables = this.collectVariables(document);
		const headers: Record<string, string> = {};
		const headerNames = new Map<string, string>();
		let bodyStart = -1;
		for (let line = requestLine + 1; line <= bounds.end; line++) {
			const text = document.lineAt(line).text;
			if (bodyStart < 0 && text.trim() === '') {
				bodyStart = line + 1;
				continue;
			}
			if (bodyStart >= 0 || /^\s*(?:#|\/\/)/.test(text)) {
				continue;
			}
			const separator = text.indexOf(':');
			if (separator < 1) {
				throw new Error(`Invalid HTTP header on line ${line + 1}.`);
			}
			const name = text.slice(0, separator).trim();
			const value = text.slice(separator + 1).trim();
			if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name)) {
				throw new Error(`Invalid HTTP header name on line ${line + 1}.`);
			}
			const resolvedValue = this.substituteVariables(value, variables);
			if (/[\r\n\0]/.test(resolvedValue)) {
				throw new Error(`Invalid HTTP header value on line ${line + 1}.`);
			}
			const existingName = headerNames.get(name.toLowerCase());
			if (existingName) {
				headers[existingName] += `${name.toLowerCase() === 'cookie' ? '; ' : ', '}${resolvedValue}`;
			} else {
				headerNames.set(name.toLowerCase(), name);
				headers[name] = resolvedValue;
			}
		}

		const rawBody =
			bodyStart >= 0
				? document
						.getText(
							new vscode.Range(bodyStart, 0, bounds.end, document.lineAt(bounds.end).text.length),
						)
						.replace(/^[\t ]*(?:#|\/\/)[^\r\n]*(?:\r?\n|$)/gm, '')
						.trimEnd()
				: '';
		const body = rawBody ? this.substituteVariables(rawBody, variables) : undefined;
		if ((parsedLine.method === 'GET' || parsedLine.method === 'HEAD') && body) {
			throw new Error(`${parsedLine.method} requests cannot include a request body.`);
		}
		if (['CONNECT', 'TRACE', 'TRACK'].includes(parsedLine.method)) {
			throw new Error(
				`${parsedLine.method} is not supported by the HTTP client's fetch transport.`,
			);
		}
		const url = this.substituteVariables(parsedLine.url, variables);
		let parsedUrl: URL;
		try {
			parsedUrl = new URL(url);
		} catch {
			throw new Error('Invalid request URL. Expected an absolute HTTP or HTTPS URL.');
		}
		if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
			throw new Error('Only HTTP and HTTPS request URLs are supported.');
		}
		if (parsedUrl.username || parsedUrl.password) {
			throw new Error(
				'Credentials in request URLs are not supported. Use an Authorization header.',
			);
		}

		return {
			method: parsedLine.method,
			url,
			headers,
			body,
			line: requestLine,
		};
	}

	getDiagnostics(document: vscode.TextDocument): vscode.Diagnostic[] {
		const diagnostics: vscode.Diagnostic[] = [];
		const variables = this.collectVariables(document);
		const contexts = this.getLineContexts(document);
		for (let line = 0; line < document.lineCount; line++) {
			const text = document.lineAt(line).text;
			if (/^\s*(?:#|\/\/)/.test(text)) {
				continue;
			}
			const methodCandidate = /^\s*([A-Za-z-]+)\b/.exec(text)?.[1].toUpperCase();
			if (
				contexts[line] === 'request' &&
				methodCandidate &&
				HTTP_METHODS.includes(methodCandidate as (typeof HTTP_METHODS)[number]) &&
				!this.parseRequestLine(text)
			) {
				diagnostics.push(
					new vscode.Diagnostic(
						document.lineAt(line).range,
						'Invalid request line. Expected: METHOD URL [HTTP/version].',
						vscode.DiagnosticSeverity.Error,
					),
				);
			}

			for (const match of text.matchAll(/\{\{\s*([\w.-]+)\s*\}\}/g)) {
				let message: string;
				try {
					this.substituteVariables(match[0], variables);
					continue;
				} catch (error) {
					message = error instanceof Error ? error.message : String(error);
				}
				const start = match.index ?? 0;
				diagnostics.push(
					new vscode.Diagnostic(
						new vscode.Range(line, start, line, start + match[0].length),
						message,
						vscode.DiagnosticSeverity.Error,
					),
				);
			}
		}
		return diagnostics;
	}

	substituteVariables(value: string, variables: Map<string, string>): string {
		const resolved = new Map<string, string>();
		const resolving = new Set<string>();
		const expand = (text: string): string =>
			text.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_match, name: string) => {
				if (resolving.has(name)) {
					throw new Error(
						`Circular HTTP variable reference: ${[...resolving, name].join(' -> ')}.`,
					);
				}
				if (resolved.has(name)) {
					return resolved.get(name)!;
				}
				const replacement = variables.get(name);
				if (replacement === undefined) {
					throw new Error(`HTTP variable "${name}" is not defined.`);
				}
				if (resolving.size >= 100) {
					throw new Error('HTTP variable nesting exceeds 100 levels.');
				}
				resolving.add(name);
				const result = expand(replacement);
				resolving.delete(name);
				resolved.set(name, result);
				return result;
			});
		return expand(value);
	}
}

export function registerHttpLanguageDiagnostics(
	context: vscode.ExtensionContext,
	service: HttpLanguageService,
): void {
	const diagnostics = vscode.languages.createDiagnosticCollection('http');
	const update = (document: vscode.TextDocument): void => {
		if (document.languageId === 'http') {
			diagnostics.set(document.uri, service.getDiagnostics(document));
		}
	};

	context.subscriptions.push(
		diagnostics,
		vscode.workspace.onDidOpenTextDocument(update),
		vscode.workspace.onDidChangeTextDocument(event => update(event.document)),
		vscode.workspace.onDidCloseTextDocument(document => diagnostics.delete(document.uri)),
	);
	vscode.workspace.textDocuments.forEach(update);
}

export function registerHttpHoverProvider(service: HttpLanguageService): vscode.Disposable {
	return vscode.languages.registerHoverProvider('http', {
		provideHover(document, position) {
			const line = document.lineAt(position.line);
			const request = service.parseRequestLine(line.text);
			if (request) {
				const contents = new vscode.MarkdownString();
				contents.appendMarkdown(`**${request.method}** \`${request.url}\``);
				contents.appendMarkdown(`\n\nProtocol: \`${request.version ?? 'HTTP/1.1 (default)'}\``);
				return new vscode.Hover(contents, line.range);
			}

			const variableReference = document.getWordRangeAtPosition(position, /\{\{\s*[\w.-]+\s*\}\}/);
			if (variableReference) {
				const name = document.getText(variableReference).replace(/[{}\s]/g, '');
				const value = service.collectVariables(document).get(name);
				if (value !== undefined) {
					return new vscode.Hover(`HTTP variable \`${name}\` = \`${value}\``, variableReference);
				}
			}
			return undefined;
		},
	});
}
