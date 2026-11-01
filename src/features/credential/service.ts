import { randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { resolveStorageDirectory } from '@/host/utils/storage';
import type { Credential } from './protocol';

export class CredentialService {
  constructor(private readonly context: vscode.ExtensionContext) {}

  private get directory(): string {
    return resolveStorageDirectory(this.context, 'credentials');
  }

  async list(): Promise<Credential[]> {
    await mkdir(this.directory, { recursive: true });
    const entries: Credential[] = [];
    const files = await readdir(this.directory, { withFileTypes: true });

    for (const file of files) {
      if (file.isFile() && file.name.endsWith('.json')) {
        try {
          const value = JSON.parse(await readFile(path.join(this.directory, file.name), 'utf8'));
          if (isCredential(value) && value.id && file.name === `${value.id}.json`) {
            entries.push(value);
          }
        } catch {
          // Ignore invalid files
        }
      }
    }

    return entries.sort(
      (first, second) =>
        first.type.localeCompare(second.type) || (first.username ?? '').localeCompare(second.username ?? ''),
    );
  }

  async save(credential: Credential): Promise<void> {
    if (!isCredential(credential)) throw new Error('Invalid credential.');
    await mkdir(this.directory, { recursive: true });
    if (!credential.id) {
      credential.id = randomUUID();
    }
    const target = path.join(this.directory, `${credential.id}.json`);
    await writeFile(target, JSON.stringify(credential, null, 2), 'utf8');
  }

  async delete(id: string): Promise<void> {
    if (!isCredentialId(id)) throw new Error('Invalid credential ID.');
    const target = path.join(this.directory, `${id}.json`);
    try {
      await rm(target);
    } catch (e: any) {
      if (e.code !== 'ENOENT') throw e;
    }
  }
}

function isCredentialId(id: string): boolean {
  return /^[a-zA-Z0-9-]+$/.test(id);
}

export function isCredential(value: unknown): value is Credential {
  if (!value || typeof value !== 'object') return false;
  const credential = value as Record<string, unknown>;
  const optionalString = (field: unknown) => field === undefined || typeof field === 'string';
  if (
    typeof credential.id !== 'string' ||
    (credential.id !== '' && !isCredentialId(credential.id)) ||
    typeof credential.description !== 'string' ||
    !optionalString(credential.username)
  )
    return false;
  if (credential.type === 'password')
    return (
      optionalString(credential.password) &&
      credential.privateKey === undefined &&
      credential.passphrase === undefined &&
      credential.apiKey === undefined
    );
  if (credential.type === 'privateKey')
    return (
      optionalString(credential.privateKey) &&
      optionalString(credential.passphrase) &&
      credential.password === undefined &&
      credential.apiKey === undefined
    );
  if (credential.type === 'apiKey')
    return (
      optionalString(credential.apiKey) &&
      credential.username === undefined &&
      credential.password === undefined &&
      credential.privateKey === undefined &&
      credential.passphrase === undefined
    );
  return false;
}
