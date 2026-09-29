import * as vscode from 'vscode';
import { buildHttpRequestData, findRequestAtLine, parseFileVariables, parseHttpDocument } from './http-parser';
import { HttpResultService } from './result-service';

export async function sendHttpRequest(targetLine?: number): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    void vscode.window.showWarningMessage('No active editor found to send HTTP request.');
    return;
  }

  const document = editor.document;
  const content = document.getText();
  const requests = parseHttpDocument(content);

  if (requests.length === 0) {
    void vscode.window.showWarningMessage('No HTTP request found in the active document.');
    return;
  }

  const line = targetLine !== undefined ? targetLine : editor.selection.active.line;
  const request = findRequestAtLine(requests, line);

  if (!request) {
    void vscode.window.showWarningMessage('Could not locate an HTTP request at the current position.');
    return;
  }

  const variables = parseFileVariables(content);
  const requestData = buildHttpRequestData(request, variables);

  await HttpResultService.getInstance().sendRequest(requestData);
}
