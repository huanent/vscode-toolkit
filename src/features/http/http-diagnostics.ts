import * as vscode from 'vscode';
import { parseHttpDocument } from './http-parser';

export function registerHttpDiagnostics(): vscode.Disposable {
  const collection = vscode.languages.createDiagnosticCollection('http');

  function update(document: vscode.TextDocument): void {
    if (document.languageId !== 'http') {
      collection.delete(document.uri);
      return;
    }

    const diagnostics: vscode.Diagnostic[] = [];
    const requests = parseHttpDocument(document.getText());
    for (const request of requests) {
      let inQuery = true;
      for (let lineNumber = request.requestLineNumber + 1; lineNumber <= request.endLine; lineNumber++) {
        const line = document.lineAt(lineNumber);
        const text = line.text;
        if (!text.trim()) break;
        if (/^\s*(#|\/\/)/.test(text)) continue;
        if (inQuery && /^\s*[?&]/.test(text)) continue;
        inQuery = false;
        if (!/^[a-zA-Z0-9_-]+\s*:/.test(text)) {
          diagnostics.push(
            new vscode.Diagnostic(line.range, 'Invalid HTTP header.', vscode.DiagnosticSeverity.Warning),
          );
        }
      }
    }

    for (let lineNumber = 0; lineNumber < document.lineCount; lineNumber++) {
      const line = document.lineAt(lineNumber);
      if (
        /^\s*(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|CONNECT|TRACE)\s*$/i.test(line.text) &&
        !requests.some((request) => lineNumber > request.requestLineNumber && lineNumber <= request.endLine)
      ) {
        diagnostics.push(
          new vscode.Diagnostic(line.range, 'HTTP request URL is missing.', vscode.DiagnosticSeverity.Error),
        );
      }
    }
    collection.set(document.uri, diagnostics);
  }

  for (const document of vscode.workspace.textDocuments) update(document);
  return vscode.Disposable.from(
    collection,
    vscode.workspace.onDidOpenTextDocument(update),
    vscode.workspace.onDidChangeTextDocument((event) => update(event.document)),
    vscode.workspace.onDidCloseTextDocument((document) => collection.delete(document.uri)),
  );
}
