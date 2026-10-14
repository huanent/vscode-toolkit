import * as vscode from 'vscode';
import { HttpDocumentSymbolProvider } from './http-document-symbol-provider';
import { HttpFoldingRangeProvider } from './http-folding-provider';
import { HttpCodeLensProvider } from './http-codelens-provider';
import { sendHttpRequest } from './send-request';
import type { HttpResultService } from './result-service';

export function registerHttpLanguage(results: HttpResultService): vscode.Disposable {
  const selector: vscode.DocumentSelector = { language: 'http' };

  return vscode.Disposable.from(
    vscode.languages.registerDocumentSymbolProvider(selector, new HttpDocumentSymbolProvider()),
    vscode.languages.registerFoldingRangeProvider(selector, new HttpFoldingRangeProvider()),
    vscode.languages.registerCodeLensProvider(selector, new HttpCodeLensProvider()),
    vscode.commands.registerCommand('toolkit.http.sendRequest', (line?: number) => sendHttpRequest(results, line)),
  );
}
