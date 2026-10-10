import { randomUUID } from 'node:crypto';
import { chmod, mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import * as path from 'node:path';

import type { CredentialSummary, CredentialType } from './protocol';
interface Credential extends CredentialSummary {
    secret: string;
    passphrase?: string;
}

export class CredentialStore {
    private pending: Promise<unknown> = Promise.resolve();
    constructor(private readonly directory: string) { }

    private file(id: string): string {
        if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error('Invalid credential ID.');
        return path.join(this.directory, `${id}.json`);
    }

    private async write(entry: Credential): Promise<void> {
        await mkdir(this.directory, { recursive: true, mode: 0o700 });
        const file = this.file(entry.id);
        const temporary = `${file}.${randomUUID()}.tmp`;
        try {
            await writeFile(temporary, JSON.stringify(entry, undefined, 2), { mode: 0o600, flag: 'wx' });
            await rename(temporary, file);
            await chmod(file, 0o600);
        } finally {
            await rm(temporary, { force: true });
        }
    }

    private enqueue<Result>(operation: () => Promise<Result>): Promise<Result> {
        const result = this.pending.then(operation);
        this.pending = result.catch(() => { });
        return result;
    }

    private async read(id: string): Promise<Credential | undefined> {
        const file = this.file(id);
        let value: string;
        try {
            value = await readFile(file, 'utf8');
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
            throw error;
        }
        const entry = JSON.parse(value) as Credential;
        if (!entry || Array.isArray(entry) || entry.id !== id || typeof entry.name !== 'string' ||
            typeof entry.user !== 'string' || typeof entry.secret !== 'string' ||
            !['password', 'privateKey', 'apikey'].includes(entry.type) ||
            (entry.passphrase !== undefined && typeof entry.passphrase !== 'string')) {
            throw new Error('Invalid credential storage. No changes were made.');
        }
        return entry;
    }

    list(): Promise<CredentialSummary[]> {
        return this.enqueue(async () => {
            let files: string[];
            try {
                files = await readdir(this.directory);
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
                throw error;
            }
            const entries: CredentialSummary[] = [];
            for (const file of files.filter(file => file.endsWith('.json')).sort()) {
                const entry = await this.read(file.slice(0, -5));
                if (entry) {
                    const { id, name, type, user } = entry;
                    entries.push({ id, name, type, user });
                }
            }
            return entries;
        });
    }

    get(id: string): Promise<Credential | undefined> {
        return this.enqueue(() => this.read(id));
    }

    save(input: unknown): Promise<CredentialSummary> {
        return this.enqueue(async () => {
            if (!input || typeof input !== 'object') throw new Error('Invalid credential.');
            const draft = input as Record<string, unknown>;
            if (typeof draft.name !== 'string' || !draft.name.trim() ||
                !['password', 'privateKey', 'apikey'].includes(draft.type as string) ||
                typeof draft.user !== 'string' || typeof draft.secret !== 'string' ||
                (draft.id !== undefined && typeof draft.id !== 'string')) throw new Error('Invalid credential.');
            const previous = draft.id === undefined ? undefined : await this.read(draft.id as string);
            if (draft.id !== undefined && !previous) throw new Error('Credential no longer exists.');
            const type = draft.type as CredentialType;
            const user = type === 'apikey' ? '' : draft.user.trim();
            const secret = draft.secret || (previous?.type === type ? previous.secret : '');
            if (type !== 'apikey' && !user) throw new Error('User is required.');
            if (!secret.trim()) throw new Error('A secret value is required.');
            const entry: Credential = { id: previous?.id ?? randomUUID(), name: draft.name.trim(), type, user, secret };
            if (draft.passphrase !== undefined && typeof draft.passphrase !== 'string') throw new Error('Invalid passphrase.');
            if (type === 'privateKey') entry.passphrase = typeof draft.passphrase === 'string' ? draft.passphrase : previous?.passphrase;
            await this.write(entry);
            return { id: entry.id, name: entry.name, type: entry.type, user: entry.user };
        });
    }

    delete(id: string): Promise<void> {
        return this.enqueue(async () => {
            await rm(this.file(id), { force: true });
        });
    }
}