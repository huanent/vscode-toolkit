import { readFileSync, readdirSync } from 'node:fs';
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
      for (const output of Object.values(bundle)) {
        if (output.type !== 'chunk' || !output.isEntry || !output.facadeModuleId) continue;

        const page = relative(webviewPagesRoot, resolve(output.facadeModuleId, '..')).split(sep).join('/');
        if (!page || page.startsWith('../')) continue;

        const dependencies = new Set<string>([output.fileName]);
        const css = new Set<string>();
        const collectDependencies = (fileName: string): void => {
          const chunk = bundle[fileName];
          if (chunk?.type !== 'chunk') return;
          for (const dependency of chunk.imports) {
            if (dependencies.has(dependency) || bundle[dependency]?.type !== 'chunk') continue;
            dependencies.add(dependency);
            collectDependencies(dependency);
          }
          for (const stylesheet of chunk.viteMetadata?.importedCss ?? []) css.add(stylesheet);
        };
        collectDependencies(output.fileName);
        dependencies.delete(output.fileName);
        const stylesheets = [...css]
          .map((fileName) => `<link rel="stylesheet" crossorigin href="/${fileName}">`)
          .join('\n    ');
        const preloads = [...dependencies]
          .map((fileName) => `<link rel="modulepreload" crossorigin href="/${fileName}">`)
          .join('\n    ');

        const html = template
          .replace('<title>SQLite Table</title>', `<title>${page}</title>`)
          .replace(
            '</head>',
            `${stylesheets ? `\n    ${stylesheets}` : ''}${preloads ? `\n    ${preloads}` : ''}\n    <script type="module" crossorigin src="/${output.fileName}"></script>\n  </head>`,
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
        plugins: [],
        build: {
          lib: {
            entry: {
              extension: resolve(import.meta.dirname, 'src/extension.ts'),
              'sqlite-process': resolve(import.meta.dirname, 'src/features/database/sqlite/process.ts'),
            },
            formats: ['cjs'],
            fileName: (_format, entryName) => `${entryName}.js`,
          },
          rollupOptions: {
            external: [
              'vscode',
              ...builtinModules,
              ...builtinModules.map((name) => `node:${name}`),
              'node:sqlite',
              'cpu-features',
              /\/sshcrypto\.node$/,
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
