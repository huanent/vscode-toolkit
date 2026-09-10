import { randomUUID } from 'node:crypto';
import { chmod, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { getStorageUri } from './storagePath';

const fields = ['password', 'privateKey', 'passphrase', 'proxyPassword', 'proxyPrivateKey', 'proxyPassphrase'] as const;
type Credentials = Partial<Record<(typeof fields)[number], string>>;
const queues = new Map<string, Promise<void>>();

export class CredentialStorage {
	private readonly file: string;

	constructor(context: vscode.ExtensionContext, private readonly namespace: string) {
		this.file = getStorageUri(context, 'secret.json').fsPath;
	}

	private enqueue<Result>(operation: () => Promise<Result>): Promise<Result> {
		const pending = (queues.get(this.file) ?? Promise.resolve()).then(operation);
		queues.set(this.file, pending.then(() => {}, () => {}));
		return pending;
	}

	private async read(): Promise<Record<string, string>> {
		let content: string;
		try {
			content = await readFile(this.file, 'utf8');
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {};
			throw error;
		}
		const values: unknown = JSON.parse(content);
		if (!values || typeof values !== 'object' || Array.isArray(values) ||
			Object.values(values).some(value => typeof value !== 'string')) {
			throw new Error('Invalid secret.json. Credential storage was not modified.');
		}
		return values as Record<string, string>;
	}

	resolve(credentials: Credentials): Promise<Credentials> {
		return this.enqueue(async () => {
			const resolved = { ...credentials };
			const values = await this.read();
			for (const field of fields) {
				const value = resolved[field];
				if (!value?.startsWith('${toolkit:')) continue;
				const key = value.slice(2, -1);
				if (!value.endsWith('}') || !Object.hasOwn(values, key)) {
					throw new Error(`Missing credential reference for ${field}. Check secret.json.`);
				}
				resolved[field] = values[key];
			}
			return resolved;
		});
	}

	store(id: string, credentials: Credentials): Promise<Credentials> {
		return this.enqueue(async () => {
			const values = await this.read();
			const references: Credentials = {};
			for (const field of fields) {
				const value = credentials[field];
				if (!value) {
					references[field] = '';
					continue;
				}
				const key = `toolkit:${this.namespace}.${id}.${field}`;
				values[key] = value;
				references[field] = '${' + key + '}';
			}
			await this.write(values);
			return references;
		});
	}

	delete(serverIds: string[]): Promise<void> {
		return this.enqueue(async () => {
			const values = await this.read();
			let changed = false;
			for (const id of serverIds) {
				for (const field of fields) {
					const key = `toolkit:${this.namespace}.${id}.${field}`;
					if (!Object.hasOwn(values, key)) continue;
					delete values[key];
					changed = true;
				}
			}
			if (changed) await this.write(values);
		});
	}

	private async write(values: Record<string, string>): Promise<void> {
		await mkdir(path.dirname(this.file), { recursive: true });
		const temporary = `${this.file}.${randomUUID()}.tmp`;
		try {
			await writeFile(temporary, JSON.stringify(values, undefined, 2), { mode: 0o600, flag: 'wx' });
			await rename(temporary, this.file);
			await chmod(this.file, 0o600);
		} finally {
			await rm(temporary, { force: true });
		}
	}
}