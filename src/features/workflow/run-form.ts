import * as vscode from 'vscode';
import { serveWebviewData } from '@/host/webview-bridge';
import { getWebviewHtml } from '@/host/webview-html';
import type { WorkflowEnvironmentValues, WorkflowEnvironmentVariable, WorkflowRunFormData } from './protocol';

export function requestWorkflowEnvironment(
  context: vscode.ExtensionContext,
  name: string,
  environment: WorkflowEnvironmentVariable[],
  cancellation?: vscode.CancellationToken,
): Promise<WorkflowEnvironmentValues | undefined> {
  if (cancellation?.isCancellationRequested) return Promise.resolve(undefined);
  const assetsUri = vscode.Uri.file(__dirname);
  const panel = vscode.window.createWebviewPanel('toolkit.workflowRun', `Run ${name}`, vscode.ViewColumn.Active, {
    enableScripts: true,
    retainContextWhenHidden: true,
    localResourceRoots: [assetsUri],
  });
  context.subscriptions.push(panel);
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (values?: WorkflowEnvironmentValues) => {
      if (settled) return;
      settled = true;
      resolve(values);
      panel.dispose();
    };
    const bridge = serveWebviewData(panel.webview, async () => ({ name, environment }) satisfies WorkflowRunFormData);
    const listener = panel.webview.onDidReceiveMessage((message: unknown) => {
      if (!message || typeof message !== 'object' || !('type' in message)) return;
      if (message.type === 'cancelWorkflowRun') finish();
      if (message.type !== 'submitWorkflowRun' || !('values' in message)) return;
      const values = message.values;
      if (!values || typeof values !== 'object') return;
      const entries: [string, string][] = [];
      for (const variable of environment) {
        if (!Object.hasOwn(values, variable.name)) return;
        const value = (values as Record<string, unknown>)[variable.name];
        if (typeof value !== 'string' || value.includes('\0')) return;
        if (variable.type === 'checkbox' && value !== 'true' && value !== 'false') return;
        if (variable.type === 'select' && !variable.options.some((option) => option.value === value)) return;
        entries.push([variable.name, value]);
      }
      finish(Object.fromEntries(entries));
    });
    const cancellationListener = cancellation?.onCancellationRequested(() => finish());
    const disposeListener = panel.onDidDispose(() => {
      bridge.dispose();
      listener.dispose();
      cancellationListener?.dispose();
      disposeListener.dispose();
      finish();
    });
    try {
      panel.webview.html = getWebviewHtml(panel.webview, assetsUri, { page: 'workflow/run' });
      if (cancellation?.isCancellationRequested) finish();
    } catch (error) {
      settled = true;
      panel.dispose();
      reject(error);
    }
  });
}
