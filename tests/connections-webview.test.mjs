import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = filename => readFileSync(new URL(filename, root), 'utf8');

test('webviews have a single global stylesheet and Tailwind entry', () => {
	const directory = new URL('webview/src/', root);
	const files = readdirSync(directory, { recursive: true }).filter(name => name.endsWith('.css'));
	for (const filename of files) {
		if (filename === 'styles.css') continue;
		const contents = readFileSync(new URL(filename, directory), 'utf8');
		assert.doesNotMatch(contents, /@import ['"]tailwindcss['"]|@layer base|:root\s*\{/, filename);
	}
	assert.equal(existsSync(new URL('webview/src/styles/connections.css', root)), false);
	assert.ok(read('vite.config.mts').includes("styles: 'webview/src/styles.css'"));
	assert.ok(read('src/webview.ts').includes("options.styleEntry ?? 'styles'"));
	assert.doesNotMatch(read('media/explorer.css'), /@layer base\{/);
	assert.doesNotMatch(read('media/chat.css'), /@layer base\{/);
});

test('connection features own their form, state, management and build entries', () => {
	const config = read('vite.config.mts');
	for (const feature of ['ssh', 'database', 'container']) {
		const base = `webview/src/features/${feature}`;
		assert.ok(existsSync(new URL(`${base}/serverForm/hooks/useServerForm.ts`, root)));
		assert.ok(existsSync(new URL(`${base}/serverForm/types.ts`, root)));
		assert.ok(config.includes(`${feature}Form: '${base}/serverForm/main.tsx'`));
		assert.ok(config.includes(`${feature}Management: '${base}/management/main.tsx'`));
		assert.doesNotMatch(read(`${base}/serverForm/App.tsx`), /model\.serverType/);
	}
	assert.equal(existsSync(new URL('webview/src/features/servers', root)), false);
});

test('form values exclude unrelated feature settings', () => {
	assert.doesNotMatch(
		read('webview/src/features/ssh/serverForm/types.ts'),
		/database:|runtime:|sshServerId:/,
	);
	assert.doesNotMatch(
		read('webview/src/features/database/serverForm/types.ts'),
		/commands:|runtime:|\n\s*privateKey:/,
	);
	assert.doesNotMatch(
		read('webview/src/features/container/serverForm/types.ts'),
		/database:|commands:/,
	);
});

test('feature components do not import another feature or the removed servers UI', () => {
	for (const feature of ['ssh', 'database', 'container']) {
		const directory = new URL(`webview/src/features/${feature}/`, root);
		for (const filename of readdirSync(directory, { recursive: true }).filter(name =>
			/\.tsx?$/.test(name),
		)) {
			const contents = readFileSync(new URL(filename, directory), 'utf8');
			for (const [, specifier] of contents.matchAll(/from ['"]([^'"]+)['"]/g)) {
				if (!specifier.startsWith('.')) continue;
				const resolved = path.resolve(directory.pathname, path.dirname(filename), specifier);
				if (resolved.includes('/webview/src/features/'))
					assert.ok(resolved.startsWith(directory.pathname), resolved);
			}
		}
	}
});
