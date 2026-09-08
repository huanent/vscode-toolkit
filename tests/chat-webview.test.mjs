import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const mediaUrl = new URL('../media/', import.meta.url);

test('built Prism language modules initialize without an existing global Prism', async () => {
	const assetsUrl = new URL('assets/', mediaUrl);
	const files = await readdir(assetsUrl);
	const filename = files.find(name => /^syntax-highlighting-.*\.js$/.test(name));
	assert.ok(filename, 'Build the webviews before running this test');
	const context = vm.createContext({});
	const modules = new Map();
	async function loadModule(url) {
		if (modules.has(url.href)) {
			return modules.get(url.href);
		}
		const module = new vm.SourceTextModule(await readFile(url, 'utf8'), {
			context,
			identifier: url.href,
		});
		modules.set(url.href, module);
		await module.link(specifier => loadModule(new URL(specifier, url)));
		return module;
	}
	const module = await loadModule(new URL(filename, assetsUrl));
	await module.evaluate();
});

test('built styles use local font files permitted by the webview CSP', async () => {
	const files = (await readdir(mediaUrl)).filter(name => name.endsWith('.css'));
	assert.ok(files.includes('chat.css'), 'Build the webviews before running this test');
	let fontCount = 0;
	for (const filename of files) {
		const cssUrl = new URL(filename, mediaUrl);
		const css = await readFile(cssUrl, 'utf8');
		assert.doesNotMatch(css, /data:(?:font\/|application\/(?:font|x-font))/);
		for (const match of css.matchAll(/url\(["']?([^\s)"']+\.(?:woff2?|ttf|otf))["']?\)/g)) {
			await readFile(new URL(match[1], cssUrl));
			fontCount++;
		}
	}
	assert.ok(fontCount > 0, 'Expected emitted font assets');
});