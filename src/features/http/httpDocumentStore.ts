import { basename } from 'node:path';
import * as vscode from 'vscode';
import { getStorageUri } from '../../storagePath';

const scheme = 'toolkit-http';
const historyKey = 'vscode-toolkit.httpClient.history';

export class HttpDocumentStore implements vscode.FileSystemProvider, vscode.Disposable {
	private readonly changeEmitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
	readonly onDidChangeFile = this.changeEmitter.event;
	private readonly storageDirectory: vscode.Uri;
	private readonly registration: vscode.Disposable;

	constructor(private readonly context: vscode.ExtensionContext) {
		this.storageDirectory = getStorageUri(context, 'http');
		this.registration = vscode.workspace.registerFileSystemProvider(scheme, this, {
			isCaseSensitive: true,
		});
	}

	async initialize(): Promise<void> {
		await vscode.workspace.fs.createDirectory(this.storageDirectory);
	}

	isManagedUri(uri: vscode.Uri): boolean {
		return uri.scheme === scheme && uri.path !== '/';
	}

	async openLastOrCreate(): Promise<void> {
		const last = await this.findMostRecentExisting();
		await this.open(last ?? (await this.create()));
	}

	async create(): Promise<vscode.Uri> {
		const uri = await this.createAvailableUri(formatLocalTimestamp(new Date()));
		const template = [
			'### New request',
			'GET https://example.com HTTP/1.1',
			'Accept: application/json',
			'',
		].join('\n');
		await vscode.workspace.fs.writeFile(uri, Buffer.from(template, 'utf8'));
		return uri;
	}

	async createAndOpen(): Promise<void> {
		await this.open(await this.create());
	}

	async open(uri: vscode.Uri): Promise<void> {
		const document = await vscode.workspace.openTextDocument(uri);
		await vscode.window.showTextDocument(document);
		await this.markVisited(uri);
	}

	async markVisited(uri: vscode.Uri): Promise<void> {
		if (this.isManagedUri(uri)) {
			await this.recordVisit(uri);
		}
	}

	async renameDocument(uri: vscode.Uri, requestedName: string): Promise<void> {
		const currentBaseName = basename(uri.path, '.http');
		const baseName = normalizeHttpBaseName(requestedName);
		if (baseName === currentBaseName) {
			return;
		}
		const target = baseName
			? this.uriForName(`${baseName}.http`)
			: await this.createAvailableUri(formatLocalTimestamp(new Date()));
		await vscode.workspace.fs.rename(uri, target, { overwrite: false });
		await this.replaceHistoryUri(uri, target);
		await this.open(target);
	}

	async deleteAndOpenPrevious(uri: vscode.Uri): Promise<void> {
		const history = this.getHistory().filter(value => value !== uri.toString());
		await vscode.workspace.fs.delete(uri, { recursive: false, useTrash: false });
		await this.context.globalState.update(historyKey, history);
		const previous = await this.findMostRecentExisting(history);
		if (previous) {
			await this.open(previous);
		} else {
			await this.createAndOpen();
		}
	}

	async validateName(uri: vscode.Uri, value: string): Promise<string | undefined> {
		const baseName = normalizeHttpBaseName(value);
		if (!baseName) {
			return undefined;
		}
		if (baseName.includes('/') || baseName.includes('\\')) {
			return 'Enter a file name without a directory path.';
		}
		const target = this.uriForName(`${baseName}.http`);
		if (target.toString() !== uri.toString() && (await this.exists(target))) {
			return 'An HTTP request with this name already exists.';
		}
		return undefined;
	}

	watch(): vscode.Disposable {
		return new vscode.Disposable(() => undefined);
	}

	stat(uri: vscode.Uri): Thenable<vscode.FileStat> {
		return vscode.workspace.fs.stat(this.toStorageUri(uri));
	}

	async readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
		return vscode.workspace.fs.readDirectory(this.toStorageUri(uri));
	}

	createDirectory(uri: vscode.Uri): Thenable<void> {
		return vscode.workspace.fs.createDirectory(this.toStorageUri(uri));
	}

	readFile(uri: vscode.Uri): Thenable<Uint8Array> {
		return vscode.workspace.fs.readFile(this.toStorageUri(uri));
	}

	async writeFile(
		uri: vscode.Uri,
		content: Uint8Array,
		options: { create: boolean; overwrite: boolean },
	): Promise<void> {
		const exists = await this.existsStorage(uri);
		if (!exists && !options.create) {
			throw vscode.FileSystemError.FileNotFound(uri);
		}
		if (exists && !options.overwrite) {
			throw vscode.FileSystemError.FileExists(uri);
		}
		await vscode.workspace.fs.writeFile(this.toStorageUri(uri), content);
		this.changeEmitter.fire([
			{ type: exists ? vscode.FileChangeType.Changed : vscode.FileChangeType.Created, uri },
		]);
	}

	async delete(uri: vscode.Uri, options: { recursive: boolean }): Promise<void> {
		await vscode.workspace.fs.delete(this.toStorageUri(uri), {
			recursive: options.recursive,
			useTrash: false,
		});
		this.changeEmitter.fire([{ type: vscode.FileChangeType.Deleted, uri }]);
	}

	async rename(
		oldUri: vscode.Uri,
		newUri: vscode.Uri,
		options: { overwrite: boolean },
	): Promise<void> {
		await vscode.workspace.fs.rename(this.toStorageUri(oldUri), this.toStorageUri(newUri), {
			overwrite: options.overwrite,
		});
		this.changeEmitter.fire([
			{ type: vscode.FileChangeType.Deleted, uri: oldUri },
			{ type: vscode.FileChangeType.Created, uri: newUri },
		]);
	}

	dispose(): void {
		this.registration.dispose();
		this.changeEmitter.dispose();
	}

	private uriForName(name: string): vscode.Uri {
		return vscode.Uri.from({ scheme, path: `/${name}` });
	}

	private toStorageUri(uri: vscode.Uri): vscode.Uri {
		const name = basename(uri.path);
		return name ? vscode.Uri.joinPath(this.storageDirectory, name) : this.storageDirectory;
	}

	private async createAvailableUri(baseName: string): Promise<vscode.Uri> {
		let suffix = 1;
		while (true) {
			const name = suffix === 1 ? `${baseName}.http` : `${baseName}-${suffix}.http`;
			const uri = this.uriForName(name);
			if (!(await this.exists(uri))) {
				return uri;
			}
			suffix++;
		}
	}

	private async recordVisit(uri: vscode.Uri): Promise<void> {
		const value = uri.toString();
		const history = [value, ...this.getHistory().filter(item => item !== value)];
		await this.context.globalState.update(historyKey, history);
	}

	private async replaceHistoryUri(oldUri: vscode.Uri, newUri: vscode.Uri): Promise<void> {
		const oldValue = oldUri.toString();
		const newValue = newUri.toString();
		const history = [
			newValue,
			...this.getHistory().filter(item => item !== oldValue && item !== newValue),
		];
		await this.context.globalState.update(historyKey, history);
	}

	private getHistory(): string[] {
		return this.context.globalState.get<string[]>(historyKey, []);
	}

	private async findMostRecentExisting(
		history = this.getHistory(),
	): Promise<vscode.Uri | undefined> {
		for (const value of history) {
			const uri = vscode.Uri.parse(value);
			if (this.isManagedUri(uri) && (await this.exists(uri))) {
				return uri;
			}
		}
		return undefined;
	}

	private exists(uri: vscode.Uri): Promise<boolean> {
		return this.existsStorage(uri);
	}

	private async existsStorage(uri: vscode.Uri): Promise<boolean> {
		try {
			await vscode.workspace.fs.stat(this.toStorageUri(uri));
			return true;
		} catch {
			return false;
		}
	}
}

export function normalizeHttpBaseName(value: string): string {
	return value.trim().replace(/\.http$/i, '');
}

export function formatLocalTimestamp(date: Date): string {
	const parts = [
		date.getFullYear(),
		date.getMonth() + 1,
		date.getDate(),
		date.getHours(),
		date.getMinutes(),
		date.getSeconds(),
	];
	return parts
		.map((part, index) => (index === 0 ? String(part) : String(part).padStart(2, '0')))
		.join('');
}
