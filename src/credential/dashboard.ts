import * as vscode from 'vscode';
import { getStorageUri } from '../storagePath';
import { CredentialStore } from './store';
import { getWebviewHtml } from '../webview';

export function registerCredential(context: vscode.ExtensionContext): void {
    let panel: vscode.WebviewPanel | undefined;
    const handleMessage = credentialDashboard(context);
    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-toolkit.openCredential', () => {
            if (panel) {
                panel.reveal();
                return;
            }
            const current = vscode.window.createWebviewPanel(
                'vscode-toolkit.credential', 'Credential - Toolkit', vscode.ViewColumn.Active,
                { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')] },
            );
            panel = current;
            current.iconPath = new vscode.ThemeIcon('key');
            const messages = current.webview.onDidReceiveMessage(message => {
                if (message.channel === 'credential') void handleMessage(message, current.webview);
            });
            current.onDidDispose(() => {
                messages.dispose();
                panel = undefined;
            });
            current.webview.html = getWebviewHtml(current.webview, context.extensionUri, { entry: 'credential', title: 'Credential' });
        }),
        { dispose: () => panel?.dispose() },
    );
}

export function credentialDashboard(context: vscode.ExtensionContext) {
    const stores = new Map<string, CredentialStore>();
    return async (message: Record<string, unknown>, webview: vscode.Webview): Promise<void> => {
        try {
            const directory = getStorageUri(context, 'credential').fsPath;
            let store = stores.get(directory);
            if (!store) {
                store = new CredentialStore(directory);
                stores.set(directory, store);
            }
            let credential;
            if (message.type === 'save') credential = await store.save(message.credential);
            else if (message.type === 'delete' && typeof message.id === 'string') {
                const entry = (await store.list()).find(item => item.id === message.id);
                if (entry && await vscode.window.showWarningMessage(`Delete credential "${entry.name}"?`, { modal: true }, 'Delete') === 'Delete') {
                    await store.delete(entry.id);
                }
            } else if (message.type !== 'list') return;
            await webview.postMessage({ channel: 'credential', type: 'state', entries: await store.list(), saved: message.type === 'save', credential, requestId: message.requestId });
        } catch {
            await webview.postMessage({ channel: 'credential', type: 'error', error: 'Could not update credentials. Check the fields and storage directory permissions.', requestId: message.requestId });
        }
    };
}