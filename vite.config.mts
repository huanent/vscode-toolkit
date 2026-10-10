import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { cp } from 'node:fs/promises';
import { builtinModules } from 'node:module';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { list } from 'postcss';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));
const externalModules = new Set([
	'vscode',
	'mysql2',
	'ssh2',
	...builtinModules,
	...builtinModules.map(module => `node:${module}`),
]);

export default defineConfig(({ mode }) => {
	const webviewBuild = process.env.VITE_BUILD_TARGET === 'webview';
	const production = mode === 'production';
	const watching = process.argv.includes('--watch');

	return {
		root: webviewBuild ? resolve(projectRoot, 'src/webview') : projectRoot,
		base: webviewBuild ? './' : undefined,
		plugins: webviewBuild
			? [
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
			]
			: [
				{
					name: 'copy-extension-resources',
					closeBundle: () =>
						cp(resolve(projectRoot, 'resources'), resolve(projectRoot, 'dist/resources'), {
							recursive: true,
						}),
				},
			],
		css: webviewBuild
			? {
				postcss: {
					plugins: [
						{
							postcssPlugin: 'katex-woff2-only',
							AtRule: {
								'font-face': rule => {
									if (!rule.source?.input.file?.replaceAll('\\', '/').includes('/katex/')) {
										return;
									}
									rule.walkDecls('src', declaration => {
										const sources = list.comma(declaration.value).filter(source => /\.woff2\b/.test(source));
										if (sources.length > 0) {
											declaration.value = sources.join(', ');
										}
									});
								},
							},
						},
					],
				},
			}
			: undefined,
		resolve: {
			alias: [
				{ find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
				{
					find: /^katex$/,
					replacement: fileURLToPath(new URL('./node_modules/katex/dist/katex.mjs', import.meta.url)),
				},
			],
		},
		build: webviewBuild
			? {
				outDir: resolve(projectRoot, 'dist/media'),
				emptyOutDir: false,
				assetsInlineLimit: filePath => (/\.(?:woff2?|ttf|otf)$/i.test(filePath) ? false : undefined),
				rolldownOptions: {
					input: {
						global: 'src/webview/global.css',
						explorerStyles: 'src/webview/pages/explorer/explorer.css',
						dashboard: 'src/webview/pages/dashboard/main.tsx',
						credential: 'src/webview/pages/credential/main.tsx',
						dashboardEditor: 'src/webview/pages/dashboard/editor.tsx',
						sshForm: 'src/webview/pages/ssh/form/main.tsx',
						workflowForm: 'src/webview/pages/workflow/form/main.tsx',
						databaseForm: 'src/webview/pages/database/serverForm/main.tsx',
						containerForm: 'src/webview/pages/container/serverForm/main.tsx',
						containerEditor: 'src/webview/pages/container/editor/main.tsx',
						result: 'src/webview/pages/result/main.tsx',
						mysqlOverview: 'src/webview/pages/database/mysql/overview/main.tsx',
						mysqlTablePreview: 'src/webview/pages/database/mysql/tablePreview/main.tsx',
						sshTerminal: 'src/webview/pages/ssh/terminal/main.tsx',
						chat: 'src/webview/pages/chat/main.tsx',
						explorer: 'src/webview/pages/explorer/main/main.tsx',
						archive: 'src/webview/pages/archive/main.tsx',
						sqlite: 'src/webview/pages/database/sqlite/main.tsx',
						spreadsheet: 'src/webview/pages/excel/main.tsx',
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
							assetInfo.names?.some(name => name === 'explorer.css' || name === 'explorerStyles.css')
								? 'explorer.css'
								: assetInfo.names?.some(name => name.endsWith('.css'))
									? '[name][extname]'
									: 'assets/[name]-[hash][extname]',
					},
				},
				cssCodeSplit: true,
			}
			: {
				lib: {
					entry: resolve(projectRoot, 'src/extension.ts'),
					formats: ['cjs'],
					fileName: () => 'extension.js',
				},
				outDir: resolve(projectRoot, 'dist'),
				emptyOutDir: !watching,
				minify: production,
				sourcemap: !production,
				rolldownOptions: {
					external: id => externalModules.has(id) || id.startsWith('mysql2/') || id.startsWith('ssh2/'),
					output: {
						chunkFileNames: 'chunks/[name]-[hash].js',
						codeSplitting: {
							groups: [
								{ name: 'exceljs', test: /[\\/]node_modules[\\/]exceljs[\\/]/, priority: 10 },
								{ name: 'vendor', test: /[\\/]node_modules[\\/]/ },
							],
						},
					},
				},
				target: 'node20',
			},
	};
});
