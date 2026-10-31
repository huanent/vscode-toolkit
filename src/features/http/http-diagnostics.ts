import * as vscode from 'vscode';
import { isHttpVariableDefined, parseFileVariables, parseHttpDocument } from './http-parser';

export function registerHttpDiagnostics(): vscode.Disposable {
  const collection = vscode.languages.createDiagnosticCollection('http');

  function update(document: vscode.TextDocument): void {
    if (document.languageId !== 'http') {
      collection.delete(document.uri);
      return;
    }

    const diagnostics: vscode.Diagnostic[] = [];
    const requests = parseHttpDocument(document.getText());
    const variables = parseFileVariables(document.getText());
    for (const request of requests) {
      for (const lineNumber of request.invalidHeaderLines) {
        const line = document.lineAt(lineNumber);
        diagnostics.push(new vscode.Diagnostic(line.range, 'Invalid HTTP header.', vscode.DiagnosticSeverity.Error));
      }
      for (let lineNumber = request.requestLineNumber; lineNumber <= request.endLine; lineNumber++) {
        const line = document.lineAt(lineNumber);
        if (/^\s*(#|\/\/)/.test(line.text)) continue;
        for (const match of line.text.matchAll(/\{\{([^}]+)\}\}/g)) {
          if (!isHttpVariableDefined(match[1], variables)) {
            const range = new vscode.Range(lineNumber, match.index, lineNumber, match.index + match[0].length);
            diagnostics.push(
              new vscode.Diagnostic(
                range,
                `Undefined HTTP variable: ${match[1].trim()}`,
                vscode.DiagnosticSeverity.Error,
              ),
            );
          }
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
      } else if (
        /^\s*(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|CONNECT|TRACE)\s+\S+/i.test(line.text) &&
        !requests.some((request) => lineNumber >= request.requestLineNumber && lineNumber <= request.endLine)
      ) {
        diagnostics.push(
          new vscode.Diagnostic(line.range, 'Invalid HTTP request line.', vscode.DiagnosticSeverity.Error),
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
