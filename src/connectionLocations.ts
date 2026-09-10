import * as vscode from 'vscode';

export class ConnectionLocations {
	private readonly locations = new Map<string, vscode.Uri>();
	constructor(private readonly globalDirectory: vscode.Uri, private readonly feature: string, private readonly subdirectory = 'connections') {}

	get folders() {
		return (vscode.workspace.workspaceFolders ?? []).map(folder => ({
			name: folder.name,
			uri: folder.uri.toString(),
		}));
	}

	private workspaceDirectory(uri: string): vscode.Uri {
		const folder = vscode.workspace.workspaceFolders?.find(candidate => candidate.uri.toString() === uri);
		if (!folder) throw new Error('Select an open workspace folder.');
		if (!vscode.workspace.isTrusted) throw new Error('Trust the workspace before saving connections.');
		return vscode.Uri.joinPath(folder.uri, '.vscode', 'toolkit', this.feature, this.subdirectory);
	}

	location(id: string): string {
		const directory = this.directory(id).toString();
		return this.folders.find(folder =>
			vscode.Uri.joinPath(vscode.Uri.parse(folder.uri), '.vscode', 'toolkit', this.feature, this.subdirectory).toString() === directory,
		)?.uri ?? '';
	}

	select(id: string, location?: string): void {
		if (location === undefined) return;
		const directory = this.resolve(location);
		const existing = this.locations.get(id);
		if (existing && existing.toString() !== directory.toString()) {
			throw new Error('The storage location of an existing connection cannot be changed.');
		}
		this.locations.set(id, directory);
	}

	resolve(location: string): vscode.Uri {
		return location ? this.workspaceDirectory(location) : this.globalDirectory;
	}

	async move(id: string, fileName: string, location?: string): Promise<void> {
		if (location === undefined) return;
		const target = this.resolve(location);
		const source = this.directory(id);
		if (target.toString() === source.toString()) return;
		await vscode.workspace.fs.createDirectory(target);
		await vscode.workspace.fs.rename(
			vscode.Uri.joinPath(source, fileName),
			vscode.Uri.joinPath(target, fileName),
			{ overwrite: false },
		);
		this.remember(id, target);
	}

	directory(id: string): vscode.Uri {
		return this.locations.get(id) ?? this.globalDirectory;
	}

	async entries(): Promise<{ name: string; directory: vscode.Uri; type: vscode.FileType }[]> {
		const directories = [this.globalDirectory, ...(vscode.workspace.isTrusted ? this.folders.map(folder => this.workspaceDirectory(folder.uri)) : [])];
		const entries = [];
		for (const directory of directories) {
			try {
				for (const [name, type] of await vscode.workspace.fs.readDirectory(directory)) {
					entries.push({ name, type, directory });
				}
			} catch (error) {
				if (!(error instanceof vscode.FileSystemError) || error.code !== 'FileNotFound') throw error;
			}
		}
		return entries;
	}

	remember(id: string, directory: vscode.Uri): void {
		this.locations.set(id, directory);
	}
}