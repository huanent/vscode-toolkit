import * as vscode from 'vscode';
import { backupStorage } from './storageBackup';
import { getStorageUri } from './storagePath';

export function registerStorageBackup(context: vscode.ExtensionContext): void {
    const root = getStorageUri(context, '').fsPath;
    const output = vscode.window.createOutputChannel('Toolkit Backup');
    let running = false;
    const check = async () => {
        if (running) return;
        running = true;
        try {
            await backupStorage(root);
        } catch (error) {
            output.appendLine(`Storage backup failed: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            running = false;
        }
    };
    const timer = setInterval(() => { void check(); }, 60_000);
    context.subscriptions.push(output, { dispose: () => clearInterval(timer) });
    void check();
}