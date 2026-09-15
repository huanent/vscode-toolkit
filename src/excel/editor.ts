import * as path from 'node:path';
import * as vscode from 'vscode';
import { getWebviewHtml } from '../webview';
import { readSpreadsheet } from './service';

export const excelEditorViewType = 'vscode-toolkit.excelEditor';

export function registerExcelEditor(context: vscode.ExtensionContext): vscode.Disposable {
    return vscode.window.registerCustomEditorProvider(excelEditorViewType, {
        openCustomDocument: (uri: vscode.Uri) => {
            validateSpreadsheetUri(uri);
            return { uri, dispose() { } };
        },
        resolveCustomEditor: (document: vscode.CustomDocument, panel: vscode.WebviewPanel) => {
            const name = path.posix.basename(document.uri.path);
            panel.webview.options = {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')],
            };
            panel.iconPath = new vscode.ThemeIcon('table');
            let disposed = false;
            const listener = panel.webview.onDidReceiveMessage(async message => {
                if (message?.type !== 'ready' || disposed) return;
                try {
                    const data = await readSpreadsheet(document.uri);
                    if (!disposed) await panel.webview.postMessage({ type: 'loaded', data });
                } catch (error) {
                    if (!disposed) await panel.webview.postMessage({
                        type: 'error',
                        message: error instanceof Error ? error.message : String(error),
                    });
                }
            });
            panel.onDidDispose(() => {
                disposed = true;
                listener.dispose();
            });
            panel.webview.html = getWebviewHtml(panel.webview, context.extensionUri, {
                entry: 'spreadsheet',
                title: name,
                rootData: { name },
            });
        },
    }, {
        supportsMultipleEditorsPerDocument: false,
        webviewOptions: { retainContextWhenHidden: true },
    });
}

function validateSpreadsheetUri(uri: vscode.Uri): void {
    if (!['.xlsx', '.csv'].includes(path.posix.extname(uri.path).toLowerCase())) {
        throw new Error('Only XLSX and CSV files can be previewed.');
    }
}