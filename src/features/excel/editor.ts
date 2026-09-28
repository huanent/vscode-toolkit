import * as vscode from 'vscode';
import { registerWebviewEditor } from '@/host/webview-editor';
import type { SpreadsheetSheet } from './protocol';
import { readSpreadsheet, validateSpreadsheetUri } from './service';

export const excelEditorViewType = 'toolkit.excelEditor';

export function registerExcelEditor(context: vscode.ExtensionContext): vscode.Disposable {
  return registerWebviewEditor<SpreadsheetSheet[]>(context, {
    viewType: excelEditorViewType,
    page: 'spreadsheet',
    icon: 'table',
    validate: validateSpreadsheetUri,
    load: readSpreadsheet,
  });
}
