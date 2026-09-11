import * as path from 'node:path';
import * as vscode from 'vscode';
import { getStorageUri } from '../../storagePath';
import type { StoredSession } from './session';

export class SessionStorage {
	private readonly sessionFiles = new Map<string, string>();
	private readonly reservedNames = new Set<string>();

	private constructor(private readonly storageUri: vscode.Uri) {}

	static async create(context: vscode.ExtensionContext): Promise<SessionStorage> {
		const storageUri = getStorageUri(context, 'chat');
		await vscode.workspace.fs.createDirectory(storageUri);
		return new SessionStorage(storageUri);
	}

	async load(): Promise<StoredSession[]> {
		return this.loadFromDirectory();
	}

	async persist(sessions: readonly StoredSession[]): Promise<void> {
		const currentIds = new Set(sessions.map(session => session.id));
		await Promise.all([
			...sessions.map(session => this.writeSession(session)),
			...[...this.sessionFiles.keys()]
				.filter(id => !currentIds.has(id))
				.map(id => this.deleteSession(id)),
		]);
	}

	private async loadFromDirectory(): Promise<StoredSession[]> {
		const entries = await vscode.workspace.fs.readDirectory(this.storageUri);
		entries.forEach(([name]) => this.reservedNames.add(name));
		const sessions: StoredSession[] = [];
		for (const [name, type] of entries) {
				if (type !== vscode.FileType.File || path.extname(name).toLowerCase() !== '.json') {
					continue;
				}
				let session: unknown;
				try {
					const content = await vscode.workspace.fs.readFile(
						vscode.Uri.joinPath(this.storageUri, name),
					);
					session = JSON.parse(new TextDecoder().decode(content));
				} catch {
					continue;
				}
				if (!isStoredSession(session) || (!/^\d+\.json$/.test(name) && name !== `${session.id}.json`)) {
					continue;
				}
				let filename = name;
				if (!/^\d+\.json$/.test(name)) {
					filename = this.reserveFilename(session.updatedAt);
					await vscode.workspace.fs.rename(
						vscode.Uri.joinPath(this.storageUri, name),
						vscode.Uri.joinPath(this.storageUri, filename),
						{ overwrite: false },
					);
				}
				this.sessionFiles.set(session.id, filename);
				sessions.push(session);
		}
		return sessions;
	}

	private reserveFilename(updatedAt: number): string {
		let timestamp = Number.isSafeInteger(updatedAt) && updatedAt >= 0 && updatedAt < Number.MAX_SAFE_INTEGER
			? updatedAt : Date.now();
		while (this.reservedNames.has(`${timestamp}.json`)) {
			timestamp += 1;
		}
		const filename = `${timestamp}.json`;
		this.reservedNames.add(filename);
		return filename;
	}

	private async writeSession(session: StoredSession): Promise<void> {
		const filename = this.sessionFiles.get(session.id) ?? this.reserveFilename(session.updatedAt);
		this.sessionFiles.set(session.id, filename);
		const uri = vscode.Uri.joinPath(this.storageUri, filename);
		const content = new TextEncoder().encode(`${JSON.stringify(session, undefined, 2)}\n`);
		await vscode.workspace.fs.writeFile(uri, content);
	}

	private async deleteSession(id: string): Promise<void> {
		const filename = this.sessionFiles.get(id);
		if (!filename) {
			return;
		}
		try {
			await vscode.workspace.fs.delete(vscode.Uri.joinPath(this.storageUri, filename));
		} catch (error) {
			if (!(error instanceof vscode.FileSystemError && error.code === 'FileNotFound')) {
				throw error;
			}
		}
		this.sessionFiles.delete(id);
	}
}

function isStoredSession(value: unknown): value is StoredSession {
	if (!value || typeof value !== 'object') {
		return false;
	}
	const session = value as Partial<StoredSession>;
	return (
		typeof session.id === 'string' &&
		typeof session.summary === 'string' &&
		typeof session.updatedAt === 'number' &&
		Array.isArray(session.messages) &&
		session.messages.every(
			message =>
				Boolean(message) &&
				(message.role === 'user' || message.role === 'assistant') &&
				typeof message.content === 'string' &&
				(message.model === undefined || typeof message.model === 'string') &&
				(message.tokenUsage === undefined || isTokenUsage(message.tokenUsage)),
		)
	);
}

function isTokenUsage(value: unknown): boolean {
	if (!value || typeof value !== 'object') {
		return false;
	}
	const usage = value as Record<string, unknown>;
	return (
		typeof usage.input === 'number' &&
		typeof usage.output === 'number' &&
		(usage.cachedInput === undefined || typeof usage.cachedInput === 'number')
	);
}
