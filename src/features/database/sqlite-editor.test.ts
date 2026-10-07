import { readFileSync } from 'node:fs';
import * as vscode from 'vscode';
import { describe, expect, it, vi } from 'vitest';
import { registerSqliteEditor, sqliteEditorViewType, sqliteOpenSqlEditorCommand } from './sqlite-editor';
import type { DatabaseDocument, DatabaseTable } from './protocol';
import { registerSqliteQueryEditor } from './sqlite-query';
import { readSqliteDatabase, updateSqliteTableSchema, validateSqliteUri } from './sqlite-service';

vi.mock('vscode', () => ({
  window: {
    registerCustomEditorProvider: vi.fn<(...args: unknown[]) => { dispose: () => void }>(() => ({
      dispose: vi.fn<() => void>(),
    })),
    showTextDocument: vi.fn<(...args: unknown[]) => Promise<vscode.TextEditor>>(async () => ({}) as vscode.TextEditor),
    showErrorMessage: vi.fn<(...args: unknown[]) => Promise<string | undefined>>(async () => undefined),
    tabGroups: { activeTabGroup: { activeTab: undefined } },
  },
  commands: {
    registerCommand: vi.fn<(...args: unknown[]) => vscode.Disposable>(() => ({ dispose: vi.fn<() => void>() })),
  },
  workspace: {
    openTextDocument: vi.fn<(...args: unknown[]) => Promise<vscode.TextDocument>>(
      async () => ({}) as vscode.TextDocument,
    ),
  },
  Uri: { joinPath: vi.fn<(...args: unknown[]) => vscode.Uri>(() => ({ fsPath: '/extension/dist' }) as vscode.Uri) },
  ThemeIcon: class {},
}));
vi.mock('@/host/webview-html', () => ({ getWebviewHtml: () => '<html></html>' }));
vi.mock('./sqlite-service', () => ({
  validateSqliteUri: vi.fn<(uri: vscode.Uri) => void>(),
  validateSqliteTableUri: vi.fn<(uri: vscode.Uri) => void>(),
  readSqliteDatabase: vi.fn<(uri: vscode.Uri) => Promise<DatabaseDocument>>(async () => ({
    engine: 'sqlite',
    tables: [],
  })),
  readSqliteTable: vi.fn<() => Promise<DatabaseTable>>(),
  createSqliteTableUri: vi.fn<() => vscode.Uri>(),
  updateSqliteTableSchema: vi.fn<() => Promise<void>>(async () => undefined),
}));
vi.mock('./sqlite-query', () => ({
  registerSqliteQueryEditor: vi.fn<(...args: unknown[]) => (uri: vscode.Uri, tableName?: string) => Promise<void>>(),
}));

describe('SQLite editor', () => {
  it('registers DB and SQLite files as the default editor', () => {
    const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
    const editor = manifest.contributes.customEditors.find(
      (entry: { viewType: string }) => entry.viewType === sqliteEditorViewType,
    );
    expect(editor.priority).toBe('default');
    expect(editor.selector.map((entry: { filenamePattern: string }) => entry.filenamePattern)).toEqual([
      '*.db',
      '*.sqlite',
    ]);
    expect(manifest.contributes.customEditors).toContainEqual({
      viewType: 'toolkit.sqliteTableEditor',
      displayName: 'SQLite Table',
      selector: [{ filenamePattern: '*.sqlite-table' }],
      priority: 'default',
    });
    expect(manifest.contributes.commands).toContainEqual({
      command: 'toolkit.sqlite.executeQuery',
      title: 'Run SQLite Query',
      icon: '$(play)',
      category: 'SQLite',
    });
    expect(manifest.contributes.keybindings).toContainEqual({
      command: 'toolkit.sqlite.executeQuery',
      key: 'ctrl+enter',
      mac: 'cmd+enter',
      when: 'toolkit.sqliteQueryEditor',
    });
    expect(manifest.contributes.commands).toContainEqual({
      command: sqliteOpenSqlEditorCommand,
      title: 'Open SQL Editor',
      icon: '$(code)',
      category: 'SQLite',
    });
    expect(manifest.contributes.menus['editor/title']).toContainEqual({
      command: sqliteOpenSqlEditorCommand,
      when: 'activeCustomEditorId == toolkit.sqliteEditor',
      group: 'navigation@1',
    });
  });

  it('delegates document validation and loading to the SQLite service', async () => {
    const openSqlQueryEditor = vi.fn<(uri: vscode.Uri, tableName?: string) => Promise<void>>(async () => undefined);
    vi.mocked(registerSqliteQueryEditor).mockReturnValueOnce(openSqlQueryEditor);
    registerSqliteEditor({
      extensionUri: { fsPath: '/extension' },
      subscriptions: [],
    } as unknown as vscode.ExtensionContext);
    const commandHandler = vi.mocked(vscode.commands.registerCommand).mock.calls.at(-1)![1] as () => Promise<void>;
    const registration = vi
      .mocked(vscode.window.registerCustomEditorProvider)
      .mock.calls.find(([viewType]) => viewType === sqliteEditorViewType)!;
    const provider = registration[1] as vscode.CustomReadonlyEditorProvider;
    const uri = { scheme: 'file', path: '/sample.db', fsPath: '/sample.db' } as vscode.Uri;
    const document = await provider.openCustomDocument(
      uri,
      {} as vscode.CustomDocumentOpenContext,
      {} as vscode.CancellationToken,
    );
    expect(registration[0]).toBe(sqliteEditorViewType);
    expect(validateSqliteUri).toHaveBeenCalledWith(uri);

    const messageListeners: Array<(message: unknown) => void | Promise<void>> = [];
    const postMessage = vi.fn<() => Promise<boolean>>(async () => true);
    const panel = {
      webview: {
        onDidReceiveMessage: (listener: (message: unknown) => void | Promise<void>) => {
          messageListeners.push(listener);
          return { dispose: vi.fn<() => void>() };
        },
        postMessage,
      },
      onDidDispose: vi.fn<(listener: () => void) => vscode.Disposable>(() => ({
        dispose: vi.fn<() => void>(),
      })),
    } as unknown as vscode.WebviewPanel;

    await provider.resolveCustomEditor(document, panel, {} as vscode.CancellationToken);
    await messageListeners[0]!({ type: 'ready' });
    expect(readSqliteDatabase).toHaveBeenCalledWith(uri);
    expect(postMessage).toHaveBeenCalledWith({ type: 'loaded', data: { engine: 'sqlite', tables: [] } });

    await messageListeners[1]!({ type: 'unsupported' });
    expect(openSqlQueryEditor).not.toHaveBeenCalled();

    await messageListeners[1]!({ type: 'activeTableChanged', tableName: 'items' });
    (vscode.window.tabGroups as unknown as { activeTabGroup: { activeTab: vscode.Tab } }).activeTabGroup.activeTab = {
      input: { viewType: sqliteEditorViewType, uri },
    } as unknown as vscode.Tab;
    await commandHandler();
    expect(openSqlQueryEditor).toHaveBeenCalledWith(uri, 'items');

    // Test schema update success
    await messageListeners[1]!({
      type: 'updateTableSchema',
      tableName: 'items',
      newTableName: 'products',
      columns: [{ name: 'id', type: 'INTEGER', primaryKey: true, notNull: false }],
    });
    expect(updateSqliteTableSchema).toHaveBeenCalledWith(uri, {
      tableName: 'items',
      newTableName: 'products',
      columns: [{ name: 'id', type: 'INTEGER', primaryKey: true, notNull: false }],
    });
    expect(postMessage).toHaveBeenCalledWith({ type: 'schemaUpdateResult', success: true });

    // Test schema update failure
    vi.mocked(updateSqliteTableSchema).mockRejectedValueOnce(new Error('Syntax error'));
    await messageListeners[1]!({
      type: 'updateTableSchema',
      tableName: 'items',
      newTableName: 'invalid',
      columns: [],
    });
    expect(postMessage).toHaveBeenCalledWith({
      type: 'schemaUpdateResult',
      success: false,
      error: 'Syntax error',
    });
  });
});
