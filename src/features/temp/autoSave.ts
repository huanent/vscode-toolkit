import * as path from 'node:path';
import * as vscode from 'vscode';
import { tempScheme } from './fileSystem';

export function containsPath(root: string, target: string): boolean {
    const relative = path.relative(root, target);
    return relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`));
}

export class TempAutoSave implements vscode.Disposable {
    private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
    private readonly subscriptions: vscode.Disposable[];
    private readonly pending = new Map<string, Promise<void>>();

    constructor() {
        this.subscriptions = [
            vscode.workspace.onDidChangeTextDocument(event => {
                const document = event.document;
                if (!event.contentChanges.length || document.uri.scheme !== tempScheme) return;
                this.clear(document);
                this.timers.set(document.uri.path, setTimeout(() => {
                    this.timers.delete(document.uri.path);
                    const previous = this.pending.get(document.uri.path) ?? Promise.resolve();
                    const saving = previous.then(() => this.save(document));
                    this.pending.set(document.uri.path, saving);
                    void saving.finally(() => {
                        if (this.pending.get(document.uri.path) === saving) this.pending.delete(document.uri.path);
                    });
                }, 500));
            }),
            vscode.workspace.onDidSaveTextDocument(document => this.clear(document)),
            vscode.workspace.onDidCloseTextDocument(document => this.clear(document)),
        ];
    }

    private clear(document: vscode.TextDocument): void {
        if (document.uri.scheme !== tempScheme) return;
        clearTimeout(this.timers.get(document.uri.path));
        this.timers.delete(document.uri.path);
    }

    async cancelWithin(target: string): Promise<void> {
        for (const [file, timer] of this.timers) {
            if (containsPath(target, file)) {
                clearTimeout(timer);
                this.timers.delete(file);
            }
        }
        await Promise.all([...this.pending].filter(([file]) => containsPath(target, file)).map(([, saving]) => saving));
    }

    private async save(document: vscode.TextDocument): Promise<void> {
        try {
            if (document.isClosed || !document.isDirty) return;
            if (!document.isClosed && document.isDirty && !await document.save()) {
                void vscode.window.showWarningMessage('Unable to auto-save the Temp file.');
            }
        } catch (error) {
            void vscode.window.showWarningMessage(`Unable to auto-save the Temp file: ${String(error)}`);
        }
    }

    dispose(): void {
        for (const subscription of this.subscriptions) subscription.dispose();
        for (const timer of this.timers.values()) clearTimeout(timer);
        this.timers.clear();
    }
}