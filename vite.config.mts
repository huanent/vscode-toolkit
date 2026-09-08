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
			{
				find: /^katex$/,
				replacement: fileURLToPath(new URL('./node_modules/katex/dist/katex.mjs', import.meta.url)),
			},
		],
	},
	build: {
		outDir: '../media',
		emptyOutDir: true,
		assetsInlineLimit: (filePath) => /\.(?:woff2?|ttf|otf)$/i.test(filePath) ? false : undefined,
		rolldownOptions: {
			input: {
				serverManagement: 'webview/src/features/servers/management/main.tsx',
				containerEditor: 'webview/src/features/servers/containerEditor/main.tsx',
				databaseSqlResults: 'webview/src/features/servers/database/sqlResults/main.tsx',
				mysqlOverview: 'webview/src/features/servers/database/mysql/overview/main.tsx',
				mysqlTablePreview: 'webview/src/features/servers/database/mysql/tablePreview/main.tsx',
				serverForm: 'webview/src/features/servers/serverForm/main.tsx',
				sshTerminal: 'webview/src/features/servers/sshTerminal/main.tsx',
				launchd: 'webview/src/features/launchd/main.tsx',
				chat: 'webview/src/features/chat/main.tsx',
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
