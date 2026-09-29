import * as vscode from 'vscode';
import { parseHttpDocument } from './http-parser';

export class HttpCodeLensProvider implements vscode.CodeLensProvider {
  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const text = document.getText();
    const requests = parseHttpDocument(text);
    const lenses: vscode.CodeLens[] = [];

    for (const request of requests) {
      const line = request.requestLineNumber;
      const range = new vscode.Range(line, 0, line, 0);

      lenses.push(
        new vscode.CodeLens(range, {
          title: '$(play) Send Request',
          tooltip: `Send ${request.method} ${request.url}`,
          command: 'toolkit.http.sendRequest',
          arguments: [line],
        }),
      );
    }

    return lenses;
  }
}
