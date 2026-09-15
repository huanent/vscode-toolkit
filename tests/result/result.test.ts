import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HttpResultView } from '../../webview/src/result/httpResultView';
import { TableResultView } from '../../webview/src/result/tableResultView';
import type { HttpResult, TableResult } from '../../src/result/protocol';

function renderHttp(result: Partial<HttpResult>) {
	return renderToStaticMarkup(
		createElement(HttpResultView, {
			result: { method: 'GET', url: 'https://example.com', state: 'success', ...result },
		}),
	);
}

function renderTable(result: TableResult) {
	return renderToStaticMarkup(createElement(TableResultView, { result }));
}

describe('HTTP results', () => {
	it('renders response metadata, headers and escaped body', () => {
		const html = renderHttp({
			status: 200,
			statusText: 'OK',
			elapsed: 12,
			headers: [['Content-Type', 'text/html']],
			body: '<script>alert(1)</script>',
		});
		expect(html).toContain('200 OK');
		expect(html).toContain('12 ms');
		expect(html).toContain('Content-Type');
		expect(html).toContain('&lt;script&gt;');
		expect(html).not.toContain('<script>');
	});

	it('renders loading without response content', () => {
		const html = renderHttp({ state: 'loading' });
		expect(html).toContain('Sending request...');
		expect(html).not.toContain('Response body');
	});

	it.each(['error', 'cancelled'] as const)('renders %s messages', state => {
		const html = renderHttp({ state, message: 'Request stopped' });
		expect(html).toContain('Request stopped');
		expect(html).not.toContain('Response body');
	});

	it('renders an empty response', () => {
		expect(renderHttp({ body: '' })).toContain('(empty response)');
	});
});

describe('table results', () => {
	it('renders columns, nulls, escaped values and source metadata', () => {
		const html = renderTable({
			kind: 'rows',
			columns: ['name', 'value'],
			rows: [['<script>', null]],
			source: 'Database local / test',
			summary: '1 row',
		});
		expect(html).toContain('name');
		expect(html).toContain('&lt;script&gt;');
		expect(html).toContain('NULL');
		expect(html).toContain('Database local / test');
		expect(html).toContain('1 row');
	});

	it('renders empty tables', () => {
		expect(renderTable({ kind: 'rows', columns: ['name'], rows: [], summary: '0 rows' })).toContain(
			'No rows returned.',
		);
	});

	it('renders command results without a table', () => {
		const html = renderTable({
			kind: 'command',
			message: 'Command completed successfully.',
			summary: '2 rows affected',
		});
		expect(html).toContain('Command completed successfully.');
		expect(html).toContain('2 rows affected');
		expect(html).not.toContain('<table');
	});
});
