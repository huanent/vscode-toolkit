import * as vscode from 'vscode';
import { registerManagementFeature } from '../servers/managementPanel';
import { ServerStore } from '../servers/servers/serverStore';

export function registerSsh(
	context: vscode.ExtensionContext,
	store: ServerStore,
): vscode.Disposable {
	return registerManagementFeature(context, store, 'SSH', 'ssh', 'remote');
}
