import type * as vscode from 'vscode';
import { registerApplication } from '@/app/registerApplication';

export function activate(context: vscode.ExtensionContext): Promise<void> {
	return registerApplication(context);
}

export function deactivate(): void { }
