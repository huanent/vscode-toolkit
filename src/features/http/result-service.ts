import * as vscode from 'vscode';
import type { HttpRequestData } from './protocol';
import type { ResultTaskService } from '@/features/result/task-service';
import { executeHttpRequest } from './http-client';
import type { CredentialService } from '@/features/credential/service';

export class HttpResultService {
  constructor(
    private readonly tasks: ResultTaskService,
    private readonly credentials: CredentialService,
  ) {}

  public async focusResultView(): Promise<void> {
    try {
      await vscode.commands.executeCommand('toolkit.results.focus');
    } catch {
      // View might not be registered yet in some tests
    }
  }

  public async sendRequest(request: HttpRequestData): Promise<void> {
    const credentialPattern = /\{\{\s*\$credential\s+([a-zA-Z0-9-]+)\s+(username|password)\s*\}\}/g;
    const hasCredential = (value: string) => /\{\{\s*\$credential\s+/.test(value);
    if (hasCredential(request.url) || (request.body && hasCredential(request.body))) {
      throw new Error('Credential references are only supported in HTTP headers.');
    }
    const credentials = await this.credentials.list();
    const headers: Record<string, string> = {};
    for (const [name, value] of Object.entries(request.headers)) {
      headers[name] = value.replace(credentialPattern, (_match, id: string, field: 'username' | 'password') => {
        const matches = credentials.filter(
          (entry) => entry.type === 'password' && (entry.id === id || (id.length === 8 && entry.id.startsWith(id))),
        );
        if (matches.length > 1) throw new Error(`Credential ID ${id} is ambiguous; use the full ID.`);
        const credential = matches[0];
        if (!credential || credential[field] === undefined) throw new Error(`Credential ${id} has no ${field}.`);
        return credential[field];
      });
    }
    const actualRequest = { ...request, headers };
    await this.focusResultView();
    await this.tasks.startTask({
      kind: 'http',
      title: `${request.method.toUpperCase()} ${request.url}`,
      input: request,
      run: async (signal) => ({ ...(await executeHttpRequest(actualRequest, { signal })), request }),
    });
  }
}
