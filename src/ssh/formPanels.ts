import * as vscode from 'vscode';
import { credentialDashboard } from '../credential/dashboard';
import { createFormSession } from '../dashboard/formSession';
import { getWebviewHtml } from '../webview';
import { Server } from './server';
import { ServerCredentials, ServerStore } from './serverStore';
import { handleMessage, ServerFormWebviewMessage } from './serverForm';

export function createSshFormPanels(context: vscode.ExtensionContext, store: ServerStore) {
    const handleCredential = credentialDashboard(context);
    const panels = new Map<string | symbol, vscode.WebviewPanel>();
    return {
        open(server?: Server, duplicate = false) {
            const key = server && !duplicate ? server.id : Symbol();
            const existing = panels.get(key);
            if (existing) {
                existing.reveal();
                return;
            }
            const title = server && !duplicate ? `Edit ${server.name}` : 'New SSH';
            const panel = vscode.window.createWebviewPanel('vscode-toolkit.ssh.workspace', title,
                vscode.ViewColumn.Active, {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')],
            });
            panels.set(key, panel);
            panel.iconPath = new vscode.ThemeIcon('terminal');
            const scoped = {
                webview: {
                    postMessage: (message: object) => panel.webview.postMessage({ ...message, channel: 'ssh' }),
                },
            } as vscode.WebviewPanel;
            const session = createFormSession<Server, ServerCredentials, ServerFormWebviewMessage>(
                scoped, async () => ({}), {},
                (message, activeServer, credentials, isDuplicate, state, saved, sessionId) =>
                    handleMessage(message, context, scoped, store, activeServer, credentials,
                        isDuplicate, state, saved, sessionId),
            );
            let ready = false;
            const messages = panel.webview.onDidReceiveMessage(async message => {
                try {
                    if (message.channel === 'credential') {
                        await handleCredential(message, panel.webview);
                        return;
                    }
                    if (message.type === 'editorReady' && !ready) {
                        ready = true;
                        await session.open(server, duplicate);
                    } else if (message.type === 'closeEditor') panel.dispose();
                    else if (message.channel === 'ssh') await session.receive(message);
                } catch (error) {
                    void vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
                }
            });
            panel.onDidDispose(() => {
                messages.dispose();
                session.dispose();
                panels.delete(key);
            });
            panel.webview.html = getWebviewHtml(panel.webview, context.extensionUri, {
                entry: 'sshForm', title,
            });
        },
        dispose() {
            for (const panel of panels.values()) panel.dispose();
        },
    };
}