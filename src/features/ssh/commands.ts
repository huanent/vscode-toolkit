import * as vscode from 'vscode';
import { parseEditorDescriptor } from './editorDescriptor';
import { ServerStore } from './serverStore';
import { runCommandInActiveTerminal, toggleSftpForActiveTerminal } from './sshTerminal';

export function registerSshCommands(store: ServerStore): vscode.Disposable {
	return vscode.Disposable.from(
		vscode.commands.registerCommand('vscode-toolkit.servers.openSftp', toggleSftpForActiveTerminal),
		vscode.commands.registerCommand(
			'vscode-toolkit.servers.runSshCommand',
			async (uri?: vscode.Uri) => {
				if (!uri) {
					return;
				}
				const server = store
					.getServers()
					.find(candidate => candidate.id === parseEditorDescriptor(uri).serverId);
				if (server?.type !== 'ssh') {
					return;
				}
				if (!server.commands.length) {
					void vscode.window.showInformationMessage(
						`No commands are configured for "${server.name}".`,
					);
					return;
				}
				const selected = await vscode.window.showQuickPick(
					server.commands.map(command => ({
						label: command.name,
						description: command.value,
						command,
					})),
					{ title: `Run Command on ${server.name}` },
				);
				if (selected && !runCommandInActiveTerminal(server.id, selected.command.value)) {
					void vscode.window.showErrorMessage(
						`The SSH terminal for "${server.name}" is not available.`,
					);
				}
			},
		),
	);
}
