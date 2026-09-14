import { builtinModules } from 'node:module';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const externalModules = new Set([
	'vscode',
	'mysql2',
	'ssh2',
	...builtinModules,
	...builtinModules.map(module => `node:${module}`),
]);

export default defineConfig({
	resolve: {
		alias: {
			'@': fileURLToPath(new URL('./src', import.meta.url)),
			'@webview': fileURLToPath(new URL('./webview/src_new', import.meta.url)),
		},
	},
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
