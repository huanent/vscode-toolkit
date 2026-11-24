import { window } from 'vscode';

export function showOperationError(error: unknown): void {
  void window.showErrorMessage(error instanceof Error ? error.message : String(error), { modal: true });
}
