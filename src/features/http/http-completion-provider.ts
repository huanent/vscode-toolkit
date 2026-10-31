import * as vscode from 'vscode';
import { parseFileVariables, parseHttpDocument } from './http-parser';

const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS', 'CONNECT', 'TRACE'];
const headers = ['Accept', 'Authorization', 'Cache-Control', 'Content-Type', 'Cookie', 'User-Agent'];
const systemVariables = ['$guid', '$timestamp', '$datetime', '$randomInt', '$processEnv'];
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
};

export class HttpCompletionProvider implements vscode.CompletionItemProvider {
  provideCompletionItems(document: vscode.TextDocument, position: vscode.Position): vscode.CompletionItem[] {
    const prefix = document.lineAt(position.line).text.slice(0, position.character);
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
      const start = position.character - headerMatch[2].length;
      const end = document.lineAt(position.line).text.length;
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
      return item;
    });
  }
}
