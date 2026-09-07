import * as path from 'node:path';
import * as vscode from 'vscode';
import { getStorageUri } from '../../storagePath';
import type { StoredSession } from './session';

export class SessionStorage {
	private readonly persistedSessionIds = new Set<string>();

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
			...[...this.persistedSessionIds]
				.filter(id => !currentIds.has(id))
				.map(id => this.deleteSession(id)),
		]);
		this.persistedSessionIds.clear();
		currentIds.forEach(id => this.persistedSessionIds.add(id));
	}

	private async loadFromDirectory(): Promise<StoredSession[]> {
		const entries = await vscode.workspace.fs.readDirectory(this.storageUri);
		const sessions = await Promise.all(
			entries.map(async ([name, type]) => {
				if (type !== vscode.FileType.File || path.extname(name).toLowerCase() !== '.json') {
					return undefined;
				}
				try {
					const content = await vscode.workspace.fs.readFile(
						vscode.Uri.joinPath(this.storageUri, name),
					);
					const session = JSON.parse(new TextDecoder().decode(content));
					if (isStoredSession(session) && name === `${session.id}.json`) {
						this.persistedSessionIds.add(session.id);
						return session;
					}
				} catch {}
				return undefined;
			}),
		);
		return sessions.filter(session => session !== undefined);
	}

	private async writeSession(session: StoredSession): Promise<void> {
		const uri = vscode.Uri.joinPath(this.storageUri, `${session.id}.json`);
		const content = new TextEncoder().encode(`${JSON.stringify(session, undefined, 2)}\n`);
		await vscode.workspace.fs.writeFile(uri, content);
	}

	private async deleteSession(id: string): Promise<void> {
		try {
			await vscode.workspace.fs.delete(vscode.Uri.joinPath(this.storageUri, `${id}.json`));
		} catch (error) {
			if (!(error instanceof vscode.FileSystemError && error.code === 'FileNotFound')) {
				throw error;
			}
		}
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
