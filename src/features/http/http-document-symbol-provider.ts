import * as vscode from 'vscode';

const methodRegex = /^\s*(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|CONNECT|TRACE)\s+(\S+)/i;
const separatorRegex = /^\s*###+\s*(.*)$/;
const directiveRegex = /^\s*#\s*@name\s+(\S+)/i;
const variableRegex = /^\s*(@[a-zA-Z0-9_.-]+)\s*=\s*(.*)$/;

interface RequestBlock {
  title?: string;
  method?: string;
  url?: string;
  startLine: number;
  selectionLine: number;
}

export class HttpDocumentSymbolProvider implements vscode.DocumentSymbolProvider {
  provideDocumentSymbols(document: vscode.TextDocument): vscode.DocumentSymbol[] {
    const symbols: vscode.DocumentSymbol[] = [];
    const lineCount = document.lineCount;

    let currentRequest: RequestBlock | null = null;

    const commitCurrentRequest = (endLine: number) => {
      if (!currentRequest) return;
      const name =
        currentRequest.title ||
        (currentRequest.method ? `${currentRequest.method} ${currentRequest.url}` : 'HTTP Request');
      const detail =
        currentRequest.title && currentRequest.method ? `${currentRequest.method} ${currentRequest.url}` : '';

      const start = new vscode.Position(currentRequest.startLine, 0);
      const end = new vscode.Position(endLine, document.lineAt(endLine).text.length);
      const selStart = new vscode.Position(currentRequest.selectionLine, 0);
      const selEnd = new vscode.Position(
        currentRequest.selectionLine,
        document.lineAt(currentRequest.selectionLine).text.length,
      );

      const symbol = new vscode.DocumentSymbol(
        name,
        detail,
        vscode.SymbolKind.Function,
        new vscode.Range(start, end),
        new vscode.Range(selStart, selEnd),
      );
      symbols.push(symbol);
      currentRequest = null;
    };

    for (let i = 0; i < lineCount; i++) {
      const lineText = document.lineAt(i).text;

      const sepMatch = lineText.match(separatorRegex);
      if (sepMatch) {
        if (currentRequest) {
          commitCurrentRequest(Math.max(0, i - 1));
        }
        const sepTitle = sepMatch[1].trim();
        currentRequest = {
          title: sepTitle || undefined,
          startLine: i,
          selectionLine: i,
        };
        continue;
      }

      const varMatch = lineText.match(variableRegex);
      if (varMatch && !currentRequest) {
        const varName = varMatch[1].trim();
        const varValue = varMatch[2].trim();
        const range = new vscode.Range(i, 0, i, lineText.length);
        const symbol = new vscode.DocumentSymbol(varName, varValue, vscode.SymbolKind.Variable, range, range);
        symbols.push(symbol);
        continue;
      }

      const dirMatch = lineText.match(directiveRegex);
      if (dirMatch) {
        if (!currentRequest) {
          currentRequest = {
            title: dirMatch[1].trim(),
            startLine: i,
            selectionLine: i,
          };
        } else if (!currentRequest.title) {
          currentRequest.title = dirMatch[1].trim();
        }
        continue;
      }

      const methodMatch = lineText.match(methodRegex);
      if (methodMatch) {
        if (!currentRequest) {
          currentRequest = {
            method: methodMatch[1].toUpperCase(),
            url: methodMatch[2],
            startLine: i,
            selectionLine: i,
          };
        } else {
          currentRequest.method = methodMatch[1].toUpperCase();
          currentRequest.url = methodMatch[2];
          if (currentRequest.selectionLine === currentRequest.startLine && !currentRequest.title) {
            currentRequest.selectionLine = i;
          }
        }
        continue;
      }
    }

    if (currentRequest) {
      commitCurrentRequest(lineCount - 1);
    }

    return symbols;
  }
}
