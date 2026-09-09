import * as vscode from 'vscode';
import { registerManagementFeature } from './managementPanel';
import { ServerStore } from './serverStore';
import { registerContainerEditor } from './editor';
import { registerContainerTools } from './tools';

export async function registerContainer(context: vscode.ExtensionContext): Promise<void> {
	const store = await ServerStore.create(context);
	context.subscriptions.push(store);
	context.subscriptions.push(
		registerManagementFeature(context, store),
		registerContainerEditor(context, store),
		registerContainerTools(store),
	);
}
