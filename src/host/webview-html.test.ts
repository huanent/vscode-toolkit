import { describe, expect, it, vi } from 'vitest';
import type * as vscode from 'vscode';
import { getWebviewHtml } from './webview-html';

const builtPage = [
	'<!doctype html>',
	'<html lang="en">',
	'\t<head>',
	'\t\t<title>Archive</title>',
	'\t\t<script type="module" crossorigin src="/archive/archive.js"></script>',
	'\t\t<link rel="modulepreload" crossorigin href="/styles/styles.js">',
	'\t\t<link rel="modulepreload" crossorigin href="/dist/dist.js">',
	'\t\t<link rel="stylesheet" crossorigin href="/styles/styles.css">',
	'\t</head>',
	'\t<body>',
	'\t\t<div id="root"></div>',
	'\t</body>',
	'</html>',
].join('\n');

vi.mock('node:fs', () => ({
	readFileSync: vi.fn<(...args: unknown[]) => string>(() => builtPage),
}));
vi.mock('vscode', () => ({
	Uri: {
		joinPath: vi.fn<(...args: unknown[]) => vscode.Uri>(
			(_base: unknown, ...segments: unknown[]) => ({ path: `/${segments.join('/')}` }) as vscode.Uri,
		),
	},
}));

function createWebview(): vscode.Webview {
	return {
		cspSource: 'vscode-webview://source',
		asWebviewUri: (uri: { path: string }) => ({ toString: () => `asset://host${uri.path}` }),
	} as unknown as vscode.Webview;
}

const assetsUri = { fsPath: '/extension/dist' } as vscode.Uri;

describe('getWebviewHtml', () => {
	it('rewrites every root-absolute asset URL emitted by Vite', () => {
		const html = getWebviewHtml(createWebview(), assetsUri, { page: 'archive' });

		expect(html).toContain('src="asset://host/archive/archive.js"');
		expect(html).toContain('href="asset://host/styles/styles.css"');
		expect(html).toContain('href="asset://host/styles/styles.js"');
		expect(html).toContain('href="asset://host/dist/dist.js"');
		expect(html).not.toContain('src="/archive/archive.js"');
		expect(html).not.toContain('href="/dist/dist.js"');
	});

	it('applies the content security policy on every webview', () => {
		const html = getWebviewHtml(createWebview(), assetsUri, { page: 'archive' });

		expect(html).toContain('http-equiv="Content-Security-Policy"');
		expect(html).toContain("default-src 'none'");
		expect(html).toContain('script-src vscode-webview://source');
	});

	it('exposes host data as kebab-cased root attributes', () => {
		const html = getWebviewHtml(createWebview(), assetsUri, {
			page: 'archive',
			title: 'sample.zip',
			data: { name: 'sample.zip', fileName: 'a&b' },
		});

		expect(html).toContain('<div id="root" data-name="sample.zip" data-file-name="a&amp;b"></div>');
		expect(html).toContain('<title>sample.zip</title>');
	});

	it('leaves the root element untouched when no data is provided', () => {
		const html = getWebviewHtml(createWebview(), assetsUri, { page: 'result' });

		expect(html).toContain('<div id="root"></div>');
		expect(html).toContain('<title>Archive</title>');
	});
});
