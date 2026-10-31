import * as vscode from 'vscode';
import { applyEdits, format, parse, type ParseError } from 'jsonc-parser';
import { parseHttpDocument } from './http-parser';

export class HttpFormattingProvider implements vscode.DocumentFormattingEditProvider {
  provideDocumentFormattingEdits(document: vscode.TextDocument, options: vscode.FormattingOptions): vscode.TextEdit[] {
    const edits: vscode.TextEdit[] = [];

    for (const request of parseHttpDocument(document.getText())) {
      let inQuery = true;
      let bodyStart = -1;
      for (let lineNumber = request.requestLineNumber; lineNumber <= request.endLine; lineNumber++) {
        const line = document.lineAt(lineNumber);
        const text = line.text;
        let formatted = text;

        if (lineNumber === request.requestLineNumber) {
          formatted = text
            .trim()
            .replace(
              /^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|CONNECT|TRACE)\s+(\S+)(?:\s+(HTTP\/[0-9.]+))?$/i,
              (_match, method: string, url: string, version: string | undefined) =>
                `${method.toUpperCase()} ${url}${version ? ` ${version}` : ''}`,
            );
        } else {
          if (text.trim() === '') {
            bodyStart = lineNumber + 1;
            break;
          }
          if (inQuery && /^[\s]*[?&]/.test(text)) {
            formatted = text.trim();
          } else {
            inQuery = false;
            formatted = text.replace(
              /^([a-zA-Z0-9_-]+)\s*:\s*(.*)$/,
              (_match, name: string, value: string) => `${name}:${value.trim() ? ` ${value.trim()}` : ''}`,
            );
          }
        }

        if (formatted !== text) edits.push(vscode.TextEdit.replace(line.range, formatted));
      }

      const contentType = Object.entries(request.headers).find(([name]) => name.toLowerCase() === 'content-type')?.[1];
      if (contentType?.split(';', 1)[0].trim().toLowerCase() !== 'application/json' || bodyStart < 0) continue;

      let bodyEnd = request.endLine;
      while (bodyEnd >= bodyStart && !document.lineAt(bodyEnd).text.trim()) bodyEnd--;
      if (bodyEnd < bodyStart) continue;

      const range = new vscode.Range(document.lineAt(bodyStart).range.start, document.lineAt(bodyEnd).range.end);
      const body = document.getText(range);
      if (body.includes('{{')) continue;
      const errors: ParseError[] = [];
      parse(body, errors, { disallowComments: true });
      if (errors.length) continue;

      const formatted = applyEdits(
        body,
        format(body, undefined, {
          insertSpaces: options.insertSpaces,
          tabSize: options.tabSize,
          eol: document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n',
        }),
      );
      if (formatted !== body) edits.push(vscode.TextEdit.replace(range, formatted));
    }

    return edits;
  }
}
