import * as vscode from 'vscode';
import { parseFileVariables } from './http-parser';
import type { CredentialService } from '@/features/credential/service';

export class HttpVariableProvider implements vscode.DefinitionProvider, vscode.HoverProvider {
  constructor(private readonly credentials: CredentialService) {}

  private findVariable(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): { name: string; line: number } | undefined {
    const text = document.lineAt(position.line).text;
    for (const match of text.matchAll(/\{\{\s*@?([a-zA-Z0-9_.-]+)\s*\}\}/g)) {
      if (position.character < match.index || position.character > match.index + match[0].length) continue;
      if (!parseFileVariables(document.getText()).has(match[1])) return undefined;
      let definition = -1;
      for (let line = 0; line < document.lineCount; line++) {
        const current = document.lineAt(line).text;
        if (/^\s*(?:(?:GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|CONNECT|TRACE)\s+\S+|https?:\/\/\S+)/i.test(current))
          break;
        const declaration = current.match(/^\s*@([a-zA-Z0-9_.-]+)\s*=/);
        if (declaration?.[1] === match[1]) definition = line;
      }
      if (definition >= 0) return { name: match[1], line: definition };
    }
    return undefined;
  }

  provideDefinition(document: vscode.TextDocument, position: vscode.Position): vscode.Location | undefined {
    const variable = this.findVariable(document, position);
    return variable ? new vscode.Location(document.uri, document.lineAt(variable.line).range) : undefined;
  }

  async provideHover(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.Hover | undefined> {
    const text = document.lineAt(position.line).text;
    for (const match of text.matchAll(/\{\{\s*\$credential\s+([a-zA-Z0-9-]+)\s+(username|password)\s*\}\}/g)) {
      if (position.character >= match.index && position.character <= match.index + match[0].length) {
        const matches = (await this.credentials.list()).filter(
          (credential) =>
            credential.type === 'password' &&
            (credential.id === match[1] || (match[1].length === 8 && credential.id.startsWith(match[1]))),
        );
        const content = new vscode.MarkdownString();
        content.appendMarkdown('**Credential**\n\n');
        if (matches.length !== 1) {
          content.appendText(matches.length ? 'Ambiguous credential ID; use the full ID.' : 'Credential not found.');
        } else {
          const credential = matches[0];
          content.appendText(
            `Username: ${credential.username || '-'}\nType: Password\nDescription: ${credential.description || '-'}\nID: ${match[1]}\nField: ${match[2]}`,
          );
        }
        return new vscode.Hover(
          content,
          new vscode.Range(position.line, match.index, position.line, match.index + match[0].length),
        );
      }
    }
    const variable = this.findVariable(document, position);
    if (!variable) return undefined;
    const value = parseFileVariables(document.getText()).get(variable.name) ?? '';
    const content = new vscode.MarkdownString();
    content.appendMarkdown('**HTTP file variable**\n\n');
    content.appendText(`@${variable.name} (line ${variable.line + 1})`);
    content.appendMarkdown('\n\n');
    content.appendText(`Value: ${value}`);
    return new vscode.Hover(content);
  }
}
