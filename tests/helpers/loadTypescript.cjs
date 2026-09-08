const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const ts = require('typescript');

module.exports = function loadTypescript(filename, dependencies = {}) {
	const absolutePath = path.resolve(filename);
	const requireFromFile = createRequire(absolutePath);
	const compiled = ts.transpileModule(fs.readFileSync(absolutePath, 'utf8'), {
		compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
	}).outputText;
	const sandbox = {
		exports: {},
		Buffer,
		Error,
		require: dependency =>
			Object.hasOwn(dependencies, dependency)
				? dependencies[dependency]
				: requireFromFile(dependency),
	};
	vm.runInNewContext(compiled, sandbox, { filename: absolutePath });
	return sandbox.exports;
};
