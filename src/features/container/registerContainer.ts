import * as vscode from 'vscode';
import { registerManagementFeature } from '../servers/managementPanel';
import { ServerStore } from '../servers/servers/serverStore';

export function registerContainer(
	context: vscode.ExtensionContext,
	store: ServerStore,
): vscode.Disposable {
	return registerManagementFeature(context, store, 'Container', 'container', 'package');
}
