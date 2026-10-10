import { open, readFile, rename, stat } from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';

export const tempScheme = 'toolkit-temp';

export function tempUri(relative: string): vscode.Uri {
    return vscode.Uri.from({ scheme: tempScheme, path: `/${relative}` });
}

export function tempRelative(uri: vscode.Uri): string {
    if (uri.scheme !== tempScheme || uri.authority || uri.query || uri.fragment ||
        !uri.path.startsWith('/') || uri.path.includes('\\') || uri.path.includes('\0') ||
        uri.path.split('/').some(part => part === '..' || part === '.')) {
        throw vscode.FileSystemError.NoPermissions('Invalid Temp path.');
    }
    return uri.path.slice(1);
}

type TempStorage = {
    resolve(relative: string): Promise<string>;
    list(relative: string): Promise<{ name: string; directory: boolean }[]>;
    create(directory: string, name: string, folder: boolean): Promise<string>;
};

export class TempFileSystem implements vscode.FileSystemProvider, vscode.Disposable {
    private readonly changes = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
    readonly onDidChangeFile = this.changes.event;

    constructor(private readonly storage: TempStorage) { }

    private async access<Result>(uri: vscode.Uri, action: (relative: string) => Promise<Result>): Promise<Result> {
        const relative = tempRelative(uri);
        try {
            return await action(relative);
        } catch (error) {
            if (error instanceof vscode.FileSystemError) throw error;
            const code = (error as NodeJS.ErrnoException).code;
            if (code === 'ENOENT') throw vscode.FileSystemError.FileNotFound(uri);
            if (code === 'EEXIST') throw vscode.FileSystemError.FileExists(uri);
            if (code === 'EISDIR') throw vscode.FileSystemError.FileIsADirectory(uri);
            throw vscode.FileSystemError.NoPermissions('Unable to access the Temp item.');
        }
    }

    watch(): vscode.Disposable {
        return new vscode.Disposable(() => undefined);
    }

    stat(uri: vscode.Uri): Promise<vscode.FileStat> {
        return this.access(uri, async relative => {
            const info = await stat(await this.storage.resolve(relative));
            return { type: info.isDirectory() ? vscode.FileType.Directory : vscode.FileType.File, ctime: info.ctimeMs, mtime: info.mtimeMs, size: info.size };
        });
    }

    readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
        return this.access(uri, async relative => (await this.storage.list(relative)).map(entry =>
            [entry.name, entry.directory ? vscode.FileType.Directory : vscode.FileType.File]));
    }

    readFile(uri: vscode.Uri): Promise<Uint8Array> {
        return this.access(uri, async relative => readFile(await this.storage.resolve(relative)));
    }

    writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean; overwrite: boolean }): Promise<void> {
        return this.access(uri, async relative => {
            let target: string;
            let created = false;
            try {
                target = await this.storage.resolve(relative);
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code !== 'ENOENT' || !options.create) throw error;
                const separator = relative.lastIndexOf('/');
                await this.storage.create(relative.slice(0, Math.max(separator, 0)), relative.slice(separator + 1), false);
                target = await this.storage.resolve(relative);
                created = true;
            }
            if (!created && !options.overwrite) throw vscode.FileSystemError.FileExists(uri);
            const file = await open(target, 'r+');
            try {
                await file.writeFile(content);
                await file.truncate(content.byteLength);
            } finally {
                await file.close();
            }
            this.changes.fire([{ type: created ? vscode.FileChangeType.Created : vscode.FileChangeType.Changed, uri }]);
        });
    }

    createDirectory(uri: vscode.Uri): Promise<void> {
        return this.access(uri, async relative => {
            if (!relative) return;
            if (relative.includes('/')) throw vscode.FileSystemError.NoPermissions('Folders can only be created at the Temp root.');
            await this.storage.create('', relative, true);
            this.changes.fire([{ type: vscode.FileChangeType.Created, uri }]);
        });
    }

    delete(uri: vscode.Uri, options: { recursive: boolean }): Promise<void> {
        return this.access(uri, async relative => {
            if (!relative) throw vscode.FileSystemError.NoPermissions('Cannot delete the Temp root.');
            await vscode.workspace.fs.delete(vscode.Uri.file(await this.storage.resolve(relative)), {
                recursive: options.recursive,
                useTrash: true,
            });
            this.changes.fire([{ type: vscode.FileChangeType.Deleted, uri }]);
        });
    }

    rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { overwrite: boolean }): Promise<void> {
        return this.access(oldUri, async source => this.access(newUri, async destination => {
            if (!source || !destination || destination.split('/').length > 2) {
                throw vscode.FileSystemError.NoPermissions('Invalid Temp destination.');
            }
            const sourcePath = await this.storage.resolve(source);
            if (!(await stat(sourcePath)).isFile()) throw vscode.FileSystemError.FileIsADirectory(oldUri);
            if (source === destination) return;
            const parent = path.posix.dirname(destination);
            const parentPath = await this.storage.resolve(parent === '.' ? '' : parent);
            try {
                await this.storage.resolve(destination);
                if (!options.overwrite) throw vscode.FileSystemError.FileExists(newUri);
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
            }
            await rename(sourcePath, path.join(parentPath, path.posix.basename(destination)));
            this.changes.fire([{ type: vscode.FileChangeType.Deleted, uri: oldUri }, { type: vscode.FileChangeType.Created, uri: newUri }]);
        }));
    }

    dispose(): void {
        this.changes.dispose();
    }
}