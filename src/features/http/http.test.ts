import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as vscode from 'vscode';
import { describe, expect, it, vi } from 'vitest';
import { HttpDocumentSymbolProvider } from './http-document-symbol-provider';
import { HttpFoldingRangeProvider } from './http-folding-provider';
import { registerHttpLanguage } from './register-http';

vi.mock('vscode', () => {
  class Position {
    constructor(
      public line: number,
      public character: number,
    ) {}
  }

  class Range {
    constructor(
      public start: Position | number,
      public end: Position | number,
      public endLine?: number,
      public endCharacter?: number,
    ) {
      if (typeof start === 'number') {
        this.start = new Position(start, end as number);
        this.end = new Position(endLine ?? 0, endCharacter ?? 0);
      }
    }
  }

  class DocumentSymbol {
    constructor(
      public name: string,
      public detail: string,
      public kind: number,
      public range: Range,
      public selectionRange: Range,
    ) {}
  }

  class FoldingRange {
    constructor(
      public start: number,
      public end: number,
      public kind?: number,
    ) {}
  }

  return {
    Position,
    Range,
    DocumentSymbol,
    FoldingRange,
    SymbolKind: {
      Function: 11,
      Variable: 12,
    },
    FoldingRangeKind: {
      Region: 3,
    },
    Disposable: {
      from: vi.fn<(...disposables: { dispose: () => void }[]) => { dispose: () => void }>(
        (...disposables: { dispose: () => void }[]) => ({
          dispose: () => disposables.forEach((d) => d.dispose()),
        }),
      ),
    },
    languages: {
      registerDocumentSymbolProvider: vi.fn<(...args: unknown[]) => { dispose: () => void }>(() => ({
        dispose: vi.fn<() => void>(),
      })),
      registerFoldingRangeProvider: vi.fn<(...args: unknown[]) => { dispose: () => void }>(() => ({
        dispose: vi.fn<() => void>(),
      })),
      registerCodeLensProvider: vi.fn<(...args: unknown[]) => { dispose: () => void }>(() => ({
        dispose: vi.fn<() => void>(),
      })),
    },
    commands: {
      registerCommand: vi.fn<(...args: unknown[]) => { dispose: () => void }>(() => ({
        dispose: vi.fn<() => void>(),
      })),
    },
  };
});

function createMockDocument(content: string): vscode.TextDocument {
  const lines = content.split('\n');
  return {
    lineCount: lines.length,
    lineAt(line: number) {
      const text = lines[line] ?? '';
      return {
        text,
        range: new vscode.Range(line, 0, line, text.length),
      } as vscode.TextLine;
    },
    getText() {
      return content;
    },
  } as unknown as vscode.TextDocument;
}

describe('HTTP language contribution', () => {
  it('defines http language and grammar in package.json with valid files', () => {
    const root = process.cwd();
    const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));

    const lang = manifest.contributes.languages.find((l: { id: string }) => l.id === 'http');
    expect(lang).toBeDefined();
    expect(lang.extensions).toContain('.http');
    expect(lang.extensions).toContain('.rest');
    expect(lang.aliases).toContain('HTTP');

    expect(existsSync(resolve(root, lang.configuration))).toBe(true);
    const config = JSON.parse(readFileSync(resolve(root, lang.configuration), 'utf8'));
    expect(config.comments.lineComment).toBe('#');

    const grammar = manifest.contributes.grammars.find((g: { language: string }) => g.language === 'http');
    expect(grammar).toBeDefined();
    expect(grammar.scopeName).toBe('source.http');
    expect(existsSync(resolve(root, grammar.path))).toBe(true);
    const grammarJson = JSON.parse(readFileSync(resolve(root, grammar.path), 'utf8'));
    expect(grammarJson.scopeName).toBe('source.http');

    const snippets = manifest.contributes.snippets.find((s: { language: string }) => s.language === 'http');
    expect(snippets).toBeDefined();
    expect(existsSync(resolve(root, snippets.path))).toBe(true);
    const snippetsJson = JSON.parse(readFileSync(resolve(root, snippets.path), 'utf8'));
    expect(snippetsJson['HTTP GET Request']).toBeDefined();
  });
});

describe('HttpDocumentSymbolProvider', () => {
  const provider = new HttpDocumentSymbolProvider();

  it('extracts variables and requests with titles and directives', () => {
    const content = [
      '@baseUrl = https://api.example.com',
      '@token = secret123',
      '',
      '### Get All Users',
      'GET {{baseUrl}}/users HTTP/1.1',
      'Authorization: Bearer {{token}}',
      '',
      '###',
      '# @name loginUser',
      'POST {{baseUrl}}/login',
      'Content-Type: application/json',
      '',
      '{',
      '  "user": "alice"',
      '}',
      '',
      '### Simple Delete',
      'DELETE {{baseUrl}}/users/1',
    ].join('\n');

    const doc = createMockDocument(content);
    const symbols = provider.provideDocumentSymbols(doc);

    expect(symbols.length).toBe(5);

    expect(symbols[0].name).toBe('@baseUrl');
    expect(symbols[0].detail).toBe('https://api.example.com');
    expect(symbols[0].kind).toBe(vscode.SymbolKind.Variable);

    expect(symbols[1].name).toBe('@token');
    expect(symbols[1].detail).toBe('secret123');
    expect(symbols[1].kind).toBe(vscode.SymbolKind.Variable);

    expect(symbols[2].name).toBe('Get All Users');
    expect(symbols[2].detail).toBe('GET {{baseUrl}}/users');
    expect(symbols[2].kind).toBe(vscode.SymbolKind.Function);

    expect(symbols[3].name).toBe('loginUser');
    expect(symbols[3].detail).toBe('POST {{baseUrl}}/login');
    expect(symbols[3].kind).toBe(vscode.SymbolKind.Function);

    expect(symbols[4].name).toBe('Simple Delete');
    expect(symbols[4].detail).toBe('DELETE {{baseUrl}}/users/1');
  });

  it('handles requests without explicit ### separator', () => {
    const content = ['GET https://example.com/api/status HTTP/1.1', 'Accept: application/json'].join('\n');

    const doc = createMockDocument(content);
    const symbols = provider.provideDocumentSymbols(doc);

    expect(symbols.length).toBe(1);
    expect(symbols[0].name).toBe('GET https://example.com/api/status');
    expect(symbols[0].kind).toBe(vscode.SymbolKind.Function);
  });
});

describe('HttpFoldingRangeProvider', () => {
  const provider = new HttpFoldingRangeProvider();

  it('provides folding ranges between ### request separators', () => {
    const content = [
      '### Request 1',
      'GET https://example.com/1',
      'Accept: application/json',
      '',
      '### Request 2',
      'POST https://example.com/2',
      'Content-Type: application/json',
      '',
      '{"id": 1}',
    ].join('\n');

    const doc = createMockDocument(content);
    const ranges = provider.provideFoldingRanges(doc);

    expect(ranges.length).toBe(2);
    expect(ranges[0].start).toBe(0);
    expect(ranges[0].end).toBe(3);
    expect(ranges[1].start).toBe(4);
    expect(ranges[1].end).toBe(8);
  });
});

describe('registerHttpLanguage', () => {
  it('registers document symbol provider and folding range provider for http', () => {
    const disposable = registerHttpLanguage();
    expect(vscode.languages.registerDocumentSymbolProvider).toHaveBeenCalledWith(
      { language: 'http' },
      expect.any(HttpDocumentSymbolProvider),
    );
    expect(vscode.languages.registerFoldingRangeProvider).toHaveBeenCalledWith(
      { language: 'http' },
      expect.any(HttpFoldingRangeProvider),
    );
    expect(disposable).toBeDefined();
  });
});
