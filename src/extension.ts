import type * as vscode from 'vscode';
import { registerApplication } from '@/app/register-application';

export function activate(context: vscode.ExtensionContext): Promise<void> {
  return registerApplication(context);
}
