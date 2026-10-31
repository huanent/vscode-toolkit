import * as vscode from 'vscode';
import { HttpDocumentSymbolProvider } from './http-document-symbol-provider';
import { HttpFoldingRangeProvider } from './http-folding-provider';
import { HttpCodeLensProvider } from './http-codelens-provider';
import { HttpFormattingProvider } from './http-formatting-provider';
import { HttpCompletionProvider } from './http-completion-provider';
import { HttpVariableProvider } from './http-variable-provider';
import { registerHttpDiagnostics } from './http-diagnostics';
import { sendHttpRequest } from './send-request';
import type { HttpResultService } from './result-service';
import type { CredentialService } from '@/features/credential/service';

export function registerHttpLanguage(results: HttpResultService, credentials: CredentialService): vscode.Disposable {
  const selector: vscode.DocumentSelector = { language: 'http' };
  const variables = new HttpVariableProvider(credentials);

  return vscode.Disposable.from(
    vscode.languages.registerDocumentSymbolProvider(selector, new HttpDocumentSymbolProvider()),
    vscode.languages.registerFoldingRangeProvider(selector, new HttpFoldingRangeProvider()),
    vscode.languages.registerCodeLensProvider(selector, new HttpCodeLensProvider()),
    vscode.languages.registerDocumentFormattingEditProvider(selector, new HttpFormattingProvider()),
    vscode.languages.registerCompletionItemProvider(
      selector,
      new HttpCompletionProvider(credentials),
      '{',
      '$',
      ':',
      ' ',
    ),
    vscode.languages.registerDefinitionProvider(selector, variables),
    vscode.languages.registerHoverProvider(selector, variables),
    registerHttpDiagnostics(),
    vscode.commands.registerCommand('toolkit.http.sendRequest', (line?: number) => sendHttpRequest(results, line)),
  );
}
