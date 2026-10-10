import * as vscode from 'vscode';
import { ChatManager } from './manager';

export async function registerChat(context: vscode.ExtensionContext): Promise<void> {
	const manager = await ChatManager.create(context);
	manager.register();
	context.subscriptions.push(manager);
}
