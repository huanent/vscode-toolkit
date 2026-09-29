import * as vscode from 'vscode';
import { describe, expect, it, vi } from 'vitest';
import { submitSqliteQuery } from './sqlite-result-service';
import { registerSqliteQueryEditor, sqliteExecuteQueryCommand, sqliteQueryEditorContext } from './sqlite-query';

vi.mock('vscode', () => ({
  commands: {
    registerCommand: vi.fn<(...args: unknown[]) => vscode.Disposable>(() => ({ dispose: vi.fn<() => void>() })),
    executeCommand: vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => undefined),
  },
  window: {
    activeTextEditor: undefined,
    onDidChangeActiveTextEditor: vi.fn<(...args: unknown[]) => vscode.Disposable>(() => ({
      dispose: vi.fn<() => void>(),
    })),
    showTextDocument: vi.fn<(...args: unknown[]) => Promise<vscode.TextEditor>>(async () => ({}) as vscode.TextEditor),
    showWarningMessage: vi.fn<(...args: unknown[]) => Promise<void>>(async () => undefined),
    showErrorMessage: vi.fn<(...args: unknown[]) => Promise<void>>(async () => undefined),
  },
  workspace: {
    openTextDocument: vi.fn<(...args: unknown[]) => Promise<vscode.TextDocument>>(
      async () => ({}) as vscode.TextDocument,
    ),
  },
}));
vi.mock('./sqlite-result-service', () => ({
  submitSqliteQuery: vi.fn<(...args: unknown[]) => Promise<void>>(async () => undefined),
}));

describe('SQLite query editor', () => {
  it('opens a table query and executes the selected SQL against its database', async () => {
    const databaseUri = { path: '/workspace/sample.sqlite' } as vscode.Uri;
    const selection = { isEmpty: false } as vscode.Selection;
    const document = {
      uri: { toString: () => 'untitled:Untitled-1' },
      getText: vi.fn<(...args: unknown[]) => string>(() => '  SELECT * FROM items;\n'),
    } as unknown as vscode.TextDocument;
    const editor = { document, selection } as unknown as vscode.TextEditor;
    vi.mocked(vscode.workspace.openTextDocument).mockResolvedValueOnce(document);
    vi.mocked(vscode.window.showTextDocument).mockResolvedValueOnce(editor);
    const context = {
      subscriptions: { push: vi.fn<(...args: unknown[]) => void>() },
    } as unknown as vscode.ExtensionContext;

    const openSqlEditor = registerSqliteQueryEditor(context);
    await openSqlEditor(databaseUri, 'odd " table');

    expect(vscode.workspace.openTextDocument).toHaveBeenCalledWith({
      language: 'sql',
      content: 'SELECT * FROM "odd "" table" LIMIT 100;\n',
    });
    expect(vscode.commands.executeCommand).toHaveBeenLastCalledWith('setContext', sqliteQueryEditorContext, true);

    Object.defineProperty(vscode.window, 'activeTextEditor', { configurable: true, value: editor });
    const commandHandler = vi
      .mocked(vscode.commands.registerCommand)
      .mock.calls.find(([commandId]) => commandId === sqliteExecuteQueryCommand)?.[1] as
      | (() => Promise<void>)
      | undefined;
    expect(commandHandler).toBeDefined();
    await commandHandler!();

    expect(document.getText).toHaveBeenCalledWith(selection);
    expect(submitSqliteQuery).toHaveBeenCalledWith(databaseUri, 'SELECT * FROM items;');
  });
});
