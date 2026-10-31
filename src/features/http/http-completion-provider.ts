import * as vscode from 'vscode';
import { parseFileVariables, parseHttpDocument } from './http-parser';
import type { CredentialService } from '@/features/credential/service';

const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS', 'CONNECT', 'TRACE'];
const headers = [
  'Accept',
  'Accept-Encoding',
  'Accept-Language',
  'Authorization',
  'Cache-Control',
  'Content-Type',
  'Cookie',
  'User-Agent',
  'Referer',
  'Origin',
];
const systemVariables = ['$guid', '$timestamp', '$datetime', '$randomInt', '$processEnv', '$credential'];
const headerValues: Record<string, string[]> = {
  accept: ['application/json', 'application/xml', 'text/plain', 'text/html', '*/*'],
  'content-type': [
    'application/json',
    'application/xml',
    'application/x-www-form-urlencoded',
    'multipart/form-data',
    'text/plain',
    'text/html',
  ],
  authorization: ['Bearer', 'Basic'],
  'cache-control': ['no-cache', 'no-store', 'max-age=0', 'public', 'private'],
  'accept-encoding': ['gzip', 'gzip, deflate, br', 'identity'],
  'accept-language': ['en-US', 'zh-CN', 'en-US,en;q=0.9'],
};

export class HttpCompletionProvider implements vscode.CompletionItemProvider {
  constructor(private readonly credentials: CredentialService) {}

  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): Promise<vscode.CompletionItem[]> {
    const prefix = document.lineAt(position.line).text.slice(0, position.character);
    const credentialMatch = prefix.match(/\{\{\s*\$credential\s+([\w-]*)$/);
    if (credentialMatch) {
      const range = new vscode.Range(
        position.line,
        position.character - credentialMatch[1].length,
        position.line,
        position.character,
      );
      const credentials = (await this.credentials.list()).filter((credential) => credential.type === 'password');
      return credentials.map((credential) => {
        const shortId = credential.id.slice(0, 8);
        const id = credentials.filter((entry) => entry.id.startsWith(shortId)).length === 1 ? shortId : credential.id;
        const item = new vscode.CompletionItem(id, vscode.CompletionItemKind.Reference);
        item.detail = `${credential.username || '-'} - Password - ${credential.description || '-'}`;
        item.filterText = `${id} ${credential.username || ''} ${credential.description || ''}`;
        item.range = range;
        return item;
      });
    }
    if (/\{\{\s*\$credential\s+[\w-]+\s+\w*$/.test(prefix)) {
      return ['username', 'password'].map((field) => new vscode.CompletionItem(field, vscode.CompletionItemKind.Field));
    }
    const variableMatch = prefix.match(/\{\{\s*([@$\w.-]*)$/);
    if (variableMatch) {
      const names = [...parseFileVariables(document.getText()).keys()].filter((name) => !name.startsWith('@'));
      const range = new vscode.Range(
        position.line,
        position.character - variableMatch[1].length,
        position.line,
        position.character,
      );
      return [...names, ...systemVariables].map((name) => {
        const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Variable);
        item.range = range;
        return item;
      });
    }

    const requests = parseHttpDocument(document.getText());
    const request = requests.find(
      (candidate) => position.line >= candidate.startLine && position.line <= candidate.endLine,
    );
    if (!request || position.line <= request.requestLineNumber) {
      if (!/^\s*[a-z]*$/i.test(prefix)) return [];
      return methods.map((method) => new vscode.CompletionItem(method, vscode.CompletionItemKind.Keyword));
    }

    for (let line = request.requestLineNumber + 1; line < position.line; line++) {
      if (!document.lineAt(line).text.trim()) return [];
    }
    const headerMatch = prefix.match(/^([a-zA-Z0-9_-]+)\s*:\s*(.*)$/);
    if (headerMatch) {
      const values = headerValues[headerMatch[1].toLowerCase()] ?? [];
      const valuePrefix = headerMatch[2];
      const lastSeparator = Math.max(valuePrefix.lastIndexOf(','), valuePrefix.lastIndexOf(';'));
      const fragment = valuePrefix.slice(lastSeparator + 1);
      const leadingSpace = fragment.length - fragment.trimStart().length;
      const start = position.character - fragment.length + leadingSpace;
      const suffix = document.lineAt(position.line).text.slice(position.character);
      const end = position.character + (suffix.match(/^[^,;\s]*/)?.[0].length ?? 0);
      return values.map((value) => {
        const item = new vscode.CompletionItem(value, vscode.CompletionItemKind.Value);
        item.range = new vscode.Range(position.line, start, position.line, end);
        return item;
      });
    }
    if (!/^[a-zA-Z0-9_-]*$/.test(prefix)) return [];
    return headers.map((header) => {
      const item = new vscode.CompletionItem(header, vscode.CompletionItemKind.Property);
      item.insertText = `${header}: `;
      if (headerValues[header.toLowerCase()])
        item.command = { command: 'editor.action.triggerSuggest', title: 'Suggest header values' };
      return item;
    });
  }
}
