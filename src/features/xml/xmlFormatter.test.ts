import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { registerXmlFormatter } from './xmlFormatter';

vi.mock('vscode', () => ({
	languages: {
		registerDocumentFormattingEditProvider: vi.fn(),
	},
	window: {
		showErrorMessage: vi.fn(),
	},
	EndOfLine: { LF: 1, CRLF: 2 },
	Range: class {
		constructor(
			public start: vscode.Position,
			public end: vscode.Position,
		) {}
	},
	TextEdit: {
		replace: vi.fn((range: vscode.Range, newText: string) => ({ range, newText })),
	},
}));

describe('XML document formatter', () => {
	let provider: vscode.DocumentFormattingEditProvider;
	const disposable = { dispose: vi.fn() };

	beforeEach(() => {
		vi.mocked(vscode.languages.registerDocumentFormattingEditProvider).mockReturnValue(disposable);
		registerXmlFormatter();
		provider = vi.mocked(vscode.languages.registerDocumentFormattingEditProvider).mock.calls[0][1];
	});

	async function format(
		source: string,
		options: vscode.FormattingOptions = { insertSpaces: true, tabSize: 2 },
		eol: vscode.EndOfLine = vscode.EndOfLine.LF,
	) {
		const positionAt = vi.fn((offset: number) => {
			const lines = source.slice(0, offset).split(/\r?\n/);
			return {
				line: lines.length - 1,
				character: lines[lines.length - 1].length,
			} as vscode.Position;
		});
		const document = { getText: () => source, positionAt, eol } as unknown as vscode.TextDocument;
		const edits = await provider.provideDocumentFormattingEdits(
			document,
			options,
			{} as vscode.CancellationToken,
		);
		return { edits, positionAt };
	}

	it('registers an XML provider and returns its disposable', () => {
		expect(vscode.languages.registerDocumentFormattingEditProvider).toHaveBeenCalledWith(
			'xml',
			expect.objectContaining({ provideDocumentFormattingEdits: expect.any(Function) }),
		);
		expect(registerXmlFormatter()).toBe(disposable);
	});

	it.each([
		['<tag/>', '<tag />'],
		['<tag attr="value"/>', '<tag attr="value" />'],
		['<root><first/><second /></root>', '<root>\n  <first />\n  <second />\n</root>'],
	])('adds one space before self-closing endings in %s', async (source, expected) => {
		const { edits } = await format(source);
		expect(edits).toEqual([{ range: expect.any(vscode.Range), newText: expected }]);
		expect((await format(expected)).edits).toEqual([]);
	});

	it.each([
		[{ insertSpaces: true, tabSize: 4 }, '    '],
		[{ insertSpaces: false, tabSize: 4 }, '\t'],
	])('respects indentation options %j', async (options, indentation) => {
		const { edits } = await format('<root><child/></root>', options);
		expect(edits?.[0].newText).toBe(`<root>\n${indentation}<child />\n</root>`);
	});

	it.each([
		[vscode.EndOfLine.LF, '\n'],
		[vscode.EndOfLine.CRLF, '\r\n'],
	])('preserves document line endings %s', async (eol, separator) => {
		const { edits } = await format('<root><child/></root>', undefined, eol);
		expect(edits?.[0].newText).toBe(`<root>${separator}  <child />${separator}</root>`);
	});

	it('replaces the entire document', async () => {
		const source = '<root>\n<child/>\n</root>';
		const { edits, positionAt } = await format(source);
		expect(positionAt.mock.calls).toEqual([[0], [source.length]]);
		expect(edits?.[0].range).toEqual({
			start: { line: 0, character: 0 },
			end: { line: 2, character: 7 },
		});
	});

	it.each(['<tag />', '<tag>text</tag>', '<root>\n  <child />\n</root>'])(
		'returns no edits for already formatted XML %s',
		async source => {
			expect((await format(source)).edits).toEqual([]);
			expect(vscode.TextEdit.replace).not.toHaveBeenCalled();
			expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
		},
	);

	it('preserves inline text content', async () => {
		const { edits } = await format('<root><child>hello &amp; world</child></root>');
		expect(edits?.[0].newText).toBe('<root>\n  <child>hello &amp; world</child>\n</root>');
	});

	it('reports invalid XML without returning edits', async () => {
		const { edits } = await format('<root><child></root>');
		expect(edits).toEqual([]);
		expect(vscode.TextEdit.replace).not.toHaveBeenCalled();
		expect(vscode.window.showErrorMessage).toHaveBeenCalledExactlyOnceWith(
			expect.stringMatching(/^Unable to format XML: .+/),
		);
	});
});
