import * as vscode from 'vscode';
import { registerManagementFeature } from './managementPanel';
import { ServerStore } from './serverStore';
import { registerSshEditor } from './editor';
import { registerSshTools } from './tools';
import { registerSshCommands } from './commands';
import { initializeSftpFileEditing } from './sshTerminal';
import { registerSshConnectionService } from './connectionService';

export async function registerSsh(context: vscode.ExtensionContext): Promise<void> {
	await initializeSftpFileEditing(context);
	const store = await ServerStore.create(context);
	context.subscriptions.push(store);
	context.subscriptions.push(
		registerSshConnectionService(store),
		registerManagementFeature(context, store),
		registerSshEditor(context, store),
		registerSshTools(store),
		registerSshCommands(store),
	);
}
