import { existsSync, readdirSync } from 'node:fs';
import { cp } from 'node:fs/promises';
import { resolve } from 'node:path';
import { defineConfig, type UserConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/** Every `src/webview/pages/<page>/index.html` becomes a build entry, so pages need no config edit. */
function discoverWebviewPages(): Record<string, string> {
  const pagesRoot = resolve(import.meta.dirname, 'src/webview/pages');
  const entries: Record<string, string> = {};
  for (const entry of readdirSync(pagesRoot, { withFileTypes: true })) {
    const htmlPath = resolve(pagesRoot, entry.name, 'index.html');
    if (entry.isDirectory() && existsSync(htmlPath)) entries[entry.name] = htmlPath;
  }
  return entries;
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
              'node:child_process',
              'node:fs',
              'node:fs/promises',
              'node:os',
              'node:perf_hooks',
              'node:path',
              'node:stream',
              'node:util',
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
        plugins: [react(), tailwindcss()],
        build: {
          rollupOptions: {
            input: discoverWebviewPages(),
            output: {
              format: 'es',
              entryFileNames: (chunk) => `${chunk.name}/[name].js`,
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
