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
			{ find: '@webview', replacement: fileURLToPath(new URL('./webview/src_new', import.meta.url)) },
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
				styles: 'webview/src/styles.css',
				dashboard: 'webview/src_new/dashboard/main.tsx',
				dashboardEditor: 'webview/src_new/dashboard/editor.tsx',
				databaseForm: 'webview/src_new/database/serverForm/main.tsx',
				containerForm: 'webview/src/features/container/serverForm/main.tsx',
				containerEditor: 'webview/src/features/container/editor/main.tsx',
				databaseSqlResults: 'webview/src_new/database/sqlResults/main.tsx',
				mysqlOverview: 'webview/src_new/database/mysql/overview/main.tsx',
				mysqlTablePreview: 'webview/src_new/database/mysql/tablePreview/main.tsx',
				sshTerminal: 'webview/src_new/ssh/terminal/main.tsx',
				chat: 'webview/src_new/chat/main.tsx',
				explorer: 'webview/src/features/explorer/main/main.tsx',
				archive: 'webview/src/features/explorer/previews/archive/main.tsx',
				sqlite: 'webview/src/features/explorer/previews/sqlite/main.tsx',
				spreadsheet: 'webview/src/features/explorer/previews/excel/main.tsx',
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
