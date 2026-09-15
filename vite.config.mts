import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
	root: 'webview',
	base: './',
	plugins: [
		{
			name: 'prism-language-dependencies',
			transform(code, id) {
				if (/[/\\]prismjs[/\\]components[/\\]prism-[\w-]+\.js$/.test(id)) {
					return { code: `import Prism from 'prismjs';\n${code}`, map: null };
				}
			},
		},
		react(),
		tailwindcss(),
	],
	resolve: {
		alias: [
			{ find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
			{ find: '@webview', replacement: fileURLToPath(new URL('./webview/src', import.meta.url)) },
			{
				find: /^katex$/,
				replacement: fileURLToPath(new URL('./node_modules/katex/dist/katex.mjs', import.meta.url)),
			},
		],
	},
	build: {
		outDir: '../media',
		emptyOutDir: true,
		assetsInlineLimit: filePath => (/\.(?:woff2?|ttf|otf)$/i.test(filePath) ? false : undefined),
		rolldownOptions: {
			input: {
				global: 'webview/src/global.css',
				dashboard: 'webview/src/dashboard/main.tsx',
				dashboardEditor: 'webview/src/dashboard/editor.tsx',
				databaseForm: 'webview/src/database/serverForm/main.tsx',
				containerForm: 'webview/src/container/serverForm/main.tsx',
				containerEditor: 'webview/src/container/editor/main.tsx',
				result: 'webview/src/result/main.tsx',
				mysqlOverview: 'webview/src/database/mysql/overview/main.tsx',
				mysqlTablePreview: 'webview/src/database/mysql/tablePreview/main.tsx',
				sshTerminal: 'webview/src/ssh/terminal/main.tsx',
				chat: 'webview/src/chat/main.tsx',
				explorer: 'webview/src/explorer/main/main.tsx',
				archive: 'webview/src/explorer/previews/archive/main.tsx',
				sqlite: 'webview/src/database/sqlite/main.tsx',
				spreadsheet: 'webview/src/explorer/previews/excel/main.tsx',
			},
			output: {
				codeSplitting: {
					groups: [
						{ name: 'katex', test: /node_modules[\\/]katex[\\/]/ },
						{ name: 'syntax-highlighting', test: /node_modules[\\/]prismjs[\\/]/ },
					],
				},
				entryFileNames: '[name].js',
				assetFileNames: assetInfo =>
					assetInfo.names?.some(name => name === 'explorer.css')
						? 'explorer.css'
						: assetInfo.names?.some(name => name.endsWith('.css'))
							? '[name][extname]'
							: 'assets/[name]-[hash][extname]',
			},
		},
		cssCodeSplit: true,
	},
});
