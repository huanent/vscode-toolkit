import * as vscode from 'vscode';
import { registerWebviewEditor } from '@/host/webview-editor';
import type { SpreadsheetSheet } from './protocol';
import { readSpreadsheet, validateSpreadsheetUri } from './service';

export const spreadsheetEditorViewType = 'toolkit.spreadsheetEditor';

export function registerSpreadsheetEditor(context: vscode.ExtensionContext): vscode.Disposable {
  return registerWebviewEditor<SpreadsheetSheet[]>(context, {
    viewType: spreadsheetEditorViewType,
    page: 'spreadsheet',
    icon: 'table',
    validate: validateSpreadsheetUri,
    load: readSpreadsheet,
  });
}
