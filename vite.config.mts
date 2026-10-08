import { readFileSync, readdirSync } from 'node:fs';
import { cp } from 'node:fs/promises';
import { builtinModules } from 'node:module';
import { relative, resolve, sep } from 'node:path';
import { defineConfig, type Plugin, type UserConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/** Every `src/webview/pages/<page>/app.tsx` becomes a build entry, so pages need no config edit. */
const webviewPagesRoot = resolve(import.meta.dirname, 'src/webview/pages');

function discoverWebviewPages(): Record<string, string> {
  const entries: Record<string, string> = {};

  function visit(directory: string): void {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const entryPath = resolve(directory, entry.name);
      if (entry.isDirectory()) visit(entryPath);
      else if (entry.name === 'app.tsx') {
        const page = relative(webviewPagesRoot, directory).split(sep).join('/');
        entries[page] = entryPath;
      }
    }
  }

  visit(webviewPagesRoot);
  return entries;
}

function emitWebviewHtml(): Plugin {
  const template = readFileSync(resolve(import.meta.dirname, 'src/webview/index.html'), 'utf8');

  return {
    name: 'emit-webview-html',
    generateBundle(_options, bundle) {
      const stylesheets = Object.values(bundle)
        .filter((output) => output.type === 'asset' && output.fileName.endsWith('.css'))
        .map((output) => `<link rel="stylesheet" crossorigin href="/${output.fileName}">`)
        .join('\n    ');

      for (const output of Object.values(bundle)) {
        if (output.type !== 'chunk' || !output.isEntry || !output.facadeModuleId) continue;

        const page = relative(webviewPagesRoot, resolve(output.facadeModuleId, '..')).split(sep).join('/');
        if (!page || page.startsWith('../')) continue;

        const html = template
          .replace('<title>SQLite Table</title>', `<title>${page}</title>`)
          .replace(
            '</head>',
            `${stylesheets ? `\n    ${stylesheets}` : ''}\n    <script type="module" crossorigin src="/${output.fileName}"></script>\n  </head>`,
          );

        this.emitFile({
          type: 'asset',
          fileName: `${page}/index.html`,
          source: html,
        });
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const production = mode === 'production';
  const target = process.env.VITE_BUILD_TARGET ?? 'extension';
  const extensionBuild = target === 'extension';
  const targetConfig: Pick<UserConfig, 'plugins' | 'build'> = extensionBuild
    ? {
        plugins: [
          {
            name: 'copy-extension-resources',
            closeBundle: () =>
              cp(resolve(import.meta.dirname, 'resource'), resolve(import.meta.dirname, 'dist/resource'), {
                recursive: true,
              }),
          },
        ],
        build: {
          lib: {
            entry: resolve(import.meta.dirname, 'src/extension.ts'),
            formats: ['cjs'],
            fileName: () => 'extension.js',
          },
          rollupOptions: {
            external: [
              'vscode',
              ...builtinModules,
              ...builtinModules.map((name) => `node:${name}`),
              'node:sqlite',
              'yauzl',
            ],
            output: {
              exports: 'named',
              sourcemapExcludeSources: true,
            },
          },
          emptyOutDir: true,
        },
      }
    : {
        plugins: [react(), tailwindcss(), emitWebviewHtml()],
        build: {
          rollupOptions: {
            input: discoverWebviewPages(),
            output: {
              format: 'es',
              entryFileNames: (chunk) => {
                const page = relative(webviewPagesRoot, resolve(chunk.facadeModuleId!, '..')).split(sep).join('/');
                const pageName = page.split('/').at(-1);
                return `${page}/${pageName}.js`;
              },
              chunkFileNames: '[name]/[name].js',
              assetFileNames: '[name]/[name][extname]',
              sourcemapExcludeSources: true,
            },
          },
          emptyOutDir: false,
        },
      };

  return {
    resolve: {
      alias: {
        '@': resolve(import.meta.dirname, 'src'),
      },
    },
    plugins: targetConfig.plugins,
    root: resolve(import.meta.dirname, 'src'),
    experimental: {
      renderBuiltUrl: (_filename, { hostType }) => {
        if (hostType === 'css') return { relative: true };
      },
    },
    build: {
      ...targetConfig.build,
      outDir: resolve(import.meta.dirname, 'dist'),
      minify: production,
      sourcemap: !production,
    },
  };
});
