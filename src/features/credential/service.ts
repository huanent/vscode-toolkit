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
          if (value && typeof value === 'object' && typeof value.id === 'string') {
            entries.push(value as Credential);
          }
        } catch {
          // Ignore invalid files
        }
      }
    }

    return entries.sort((first, second) => first.name.localeCompare(second.name));
  }

  async save(credential: Credential): Promise<void> {
    await mkdir(this.directory, { recursive: true });
    if (!credential.id) {
      credential.id = randomUUID();
    }
    const target = path.join(this.directory, `${credential.id}.json`);
    await writeFile(target, JSON.stringify(credential, null, 2), 'utf8');
  }

  async delete(id: string): Promise<void> {
    const target = path.join(this.directory, `${id}.json`);
    try {
      await rm(target);
    } catch (e: any) {
      if (e.code !== 'ENOENT') throw e;
    }
  }
}
