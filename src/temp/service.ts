import { mkdir, readdir, realpath, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { getStorageUri } from '../storagePath';
import { containsPath, TempAutoSave } from './autoSave';
import { TempFileSystem, tempScheme, tempUri } from './fileSystem';

export class TempService implements vscode.Disposable {
    private readonly autoSave: TempAutoSave;
    private readonly fileSystem: TempFileSystem;
    private readonly registration: vscode.Disposable;

    constructor(private readonly context: vscode.ExtensionContext) {
        this.fileSystem = new TempFileSystem({ resolve: relative => this.resolve(relative), list: directory => this.list(directory), create: (directory, name, folder) => this.create(directory, name, folder) });
        this.registration = vscode.workspace.registerFileSystemProvider(tempScheme, this.fileSystem, { isCaseSensitive: true });
        this.autoSave = new TempAutoSave();
    }

    dispose(): void {
        this.autoSave.dispose();
        this.registration.dispose();
        this.fileSystem.dispose();
    }

    private async root(): Promise<string> {
        const root = getStorageUri(this.context, 'temp').fsPath;
        await mkdir(root, { recursive: true });
        return realpath(root);
    }

    private async resolve(relative: string): Promise<string> {
        const root = await this.root();
        const target = path.resolve(root, relative);
        if (!containsPath(root, target)) throw new Error('Path must be inside Temp.');
        const resolved = await realpath(target);
        if (!containsPath(root, resolved)) throw new Error('Path must be inside Temp.');
        return resolved;
    }

    async list(directory: string) {
        const entries = await readdir(await this.resolve(directory), { withFileTypes: true });
        return entries.filter(entry => entry.isDirectory() || entry.isFile()).map(entry => ({
            name: entry.name,
            path: path.posix.join(directory, entry.name),
            directory: entry.isDirectory(),
        })).sort((first, second) => Number(second.directory) - Number(first.directory) || first.name.localeCompare(second.name));
    }

    async create(directory: string, name: string, folder: boolean): Promise<string> {
        if (!name.trim() || name === '.' || name === '..' || /[/\\]/.test(name) || name.includes('\0')) {
            throw new Error('Enter a file or folder name without path separators.');
        }
        const parent = await this.resolve(directory);
        const relative = path.relative(await this.root(), parent);
        if ((folder && relative !== '') || relative.split(path.sep).length > 1) {
            throw new Error('Folders can only be created at the Temp root.');
        }
        const target = path.join(parent, name);
        if (folder) await mkdir(target);
        else await writeFile(target, '', { flag: 'wx' });
        return path.posix.join(directory, name);
    }

    async open(relative: string): Promise<void> {
        await this.resolve(relative);
        const uri = tempUri(relative);
        const document = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(document, { preview: false });
    }

    private async createNewFile(directory: string, name: string): Promise<string> {
        const extension = path.posix.extname(name);
        const base = name.slice(0, name.length - extension.length);
        for (let index = 0; ; index++) {
            const candidate = index === 0 ? name : `${base}-${index}${extension}`;
            try {
                return await this.create(directory, candidate, false);
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
            }
        }
    }

    async handle(message: { type?: unknown; directory?: unknown; path?: unknown }, webview?: vscode.Webview): Promise<void> {
        try {
            if (message.type === 'selectFolder' && typeof message.path === 'string') {
                const destination = await this.selectFolder(message.path);
                if (destination === undefined) return;
                const parent = path.posix.dirname(message.path);
                for (const directory of new Set(['', parent === '.' ? '' : parent, destination])) {
                    await webview?.postMessage({ channel: 'temp', type: 'entries', directory, entries: await this.list(directory) });
                }
                return;
            }
            if (message.type === 'delete' && typeof message.path === 'string') {
                await this.delete(message.path);
                const parent = path.posix.dirname(message.path);
                const directory = parent === '.' ? '' : parent;
                await webview?.postMessage({ channel: 'temp', type: 'entries', directory, entries: await this.list(directory) });
                return;
            }
            if (message.type === 'open' && typeof message.path === 'string') {
                await this.open(message.path);
                return;
            }
            if (!['list', 'newFile', 'newFolder'].includes(String(message.type))) return;
            const directory = typeof message.directory === 'string' ? message.directory : '';
            let created: string | undefined;
            if (message.type !== 'list') {
                if (directory !== '') throw new Error('Create Temp items at the root, then select a folder to move files.');
                const name = await vscode.window.showInputBox({ title: message.type === 'newFolder' ? 'New Temp folder' : 'New Temp file', prompt: 'Name' });
                if (!name) return;
                created = message.type === 'newFolder'
                    ? await this.create(directory, name, true)
                    : await this.createNewFile(directory, name);
            }
            await webview?.postMessage({ channel: 'temp', type: 'entries', directory, entries: await this.list(directory) });
            if (created && message.type === 'newFile') await this.open(created);
        } catch (error) {
            await webview?.postMessage({ channel: 'temp', type: 'error', message: String(error) });
            void vscode.window.showErrorMessage(`Temp: ${String(error)}`);
        }
    }

    async selectFolder(relative: string): Promise<string | undefined> {
        const uri = tempUri(relative);
        if ((await this.fileSystem.stat(uri)).type !== vscode.FileType.File) return;
        const parent = path.posix.dirname(relative);
        const current = parent === '.' ? '' : parent;
        const choices = [{ label: 'Temp (root)', directory: '' },
        ...(await this.list('')).filter(entry => entry.directory).map(entry => ({ label: entry.name, directory: entry.path }))];
        const selected = await vscode.window.showQuickPick(choices.map(choice => ({ ...choice, description: choice.directory === current ? 'Current folder' : undefined })), { title: 'Select folder', placeHolder: 'Move file to' });
        if (!selected || selected.directory === current) return;
        const destination = tempUri(path.posix.join(selected.directory, path.posix.basename(relative)));
        await this.autoSave.cancelWithin(uri.path);
        const document = vscode.workspace.textDocuments.find(document => document.uri.toString() === uri.toString());
        if (document?.isDirty && !await document.save()) throw new Error('Unable to save the Temp file before moving it.');
        const edit = new vscode.WorkspaceEdit();
        edit.renameFile(uri, destination, { overwrite: false });
        if (!await vscode.workspace.applyEdit(edit)) throw new Error('Unable to move the Temp file.');
        return selected.directory;
    }

    async delete(relative: string): Promise<void> {
        const target = await this.resolve(relative);
        if (target === await this.root()) throw new Error('Cannot delete the Temp root.');
        const uri = tempUri(relative);
        await this.autoSave.cancelWithin(uri.path);
        const edit = new vscode.WorkspaceEdit();
        edit.deleteFile(uri, { recursive: true });
        if (!await vscode.workspace.applyEdit(edit)) throw new Error('Unable to delete the Temp item.');
    }
}