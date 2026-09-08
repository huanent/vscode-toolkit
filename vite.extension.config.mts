import { builtinModules } from 'node:module';
import { defineConfig } from 'vite';

const externalModules = new Set([
	'vscode',
	'mysql2',
	'ssh2',
	...builtinModules,
	...builtinModules.map(module => `node:${module}`),
]);

export default defineConfig({
	build: {
		lib: {
			entry: 'src/extension.ts',
			formats: ['cjs'],
			fileName: () => 'extension.js',
		},
		outDir: 'out',
		emptyOutDir: true,
		minify: false,
		rolldownOptions: {
			external: id => externalModules.has(id) || id.startsWith('mysql2/') || id.startsWith('ssh2/'),
		},
		target: 'node20',
	},
});
