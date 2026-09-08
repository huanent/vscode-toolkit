import * as vscode from 'vscode';
import { openServerConnection, openServerForm } from './editors/serversEditor';
import { parseEditorDescriptor } from './editors/editorDescriptor';
import { Server, ServerType } from './servers/server';
import { ServerStore } from './servers/serverStore';
import { exportServer, exportServers, importServers } from './servers/serverTransfer';
import { ServerGroupTreeItem, ServerTreeDataProvider, ServerTreeItem } from './servers/serverTree';
import {
	queueCommandForTerminal,
	runCommandInActiveTerminal,
	toggleSftpForActiveTerminal,
} from './ssh/sshTerminal';

const commandIds = {
	addServer: 'vscode-toolkit.servers.addServer',
	importServers: 'vscode-toolkit.servers.importServers',
	exportServers: 'vscode-toolkit.servers.exportServers',
	exportServer: 'vscode-toolkit.servers.exportServer',
	connectServer: 'vscode-toolkit.servers.connectServer',
	copyHost: 'vscode-toolkit.servers.copyHost',
	copyInfo: 'vscode-toolkit.servers.copyInfo',
	editServer: 'vscode-toolkit.servers.editServer',
	duplicateServer: 'vscode-toolkit.servers.duplicateServer',
	renameGroup: 'vscode-toolkit.servers.renameGroup',
	moveGroupUp: 'vscode-toolkit.servers.moveGroupUp',
	moveGroupDown: 'vscode-toolkit.servers.moveGroupDown',
	moveServerUp: 'vscode-toolkit.servers.moveServerUp',
	moveServerDown: 'vscode-toolkit.servers.moveServerDown',
	moveSelectionUp: 'vscode-toolkit.servers.moveSelectionUp',
	moveSelectionDown: 'vscode-toolkit.servers.moveSelectionDown',
	deleteServer: 'vscode-toolkit.servers.deleteServer',
	openSftp: 'vscode-toolkit.servers.openSftp',
	searchServers: 'vscode-toolkit.servers.searchServers',
	clearServerSearch: 'vscode-toolkit.servers.clearServerSearch',
	runSshCommand: 'vscode-toolkit.servers.runSshCommand',
} as const;

export function registerServerCommands(
	serverStore: ServerStore,
	treeDataProvider: ServerTreeDataProvider,
	treeView: vscode.TreeView<ServerGroupTreeItem | ServerTreeItem>,
): vscode.Disposable {
	return vscode.Disposable.from(
		vscode.commands.registerCommand(commandIds.addServer, selectAndAddServer),
		vscode.commands.registerCommand(commandIds.importServers, () => importServers(serverStore)),
		vscode.commands.registerCommand(commandIds.exportServers, () => exportServers(serverStore)),
		vscode.commands.registerCommand(
			commandIds.exportServer,
			(item: ServerTreeItem, selectedItems?: ServerTreeItem[]) =>
				exportServer(serverStore, getSelectedServers(item, selectedItems)),
		),
		vscode.commands.registerCommand(commandIds.connectServer, (item: ServerTreeItem) =>
			openServerConnection(item.server),
		),
		vscode.commands.registerCommand(commandIds.copyHost, (item: ServerTreeItem) =>
			vscode.env.clipboard.writeText(getConnectionAddress(item.server)),
		),
		vscode.commands.registerCommand(commandIds.copyInfo, (item: ServerTreeItem) =>
			vscode.env.clipboard.writeText(getServerInfo(item.server)),
		),
		vscode.commands.registerCommand(commandIds.editServer, (item: ServerTreeItem) =>
			openServerForm(item.server.type, item.server),
		),
		vscode.commands.registerCommand(commandIds.duplicateServer, (item: ServerTreeItem) =>
			openServerForm(item.server.type, item.server, true),
		),
		vscode.commands.registerCommand(commandIds.renameGroup, (item: ServerGroupTreeItem) =>
			renameGroup(serverStore, item),
		),
		vscode.commands.registerCommand(commandIds.moveGroupUp, (item?: ServerGroupTreeItem) =>
			moveSelectedGroup(serverStore, treeView, item, 'up'),
		),
		vscode.commands.registerCommand(commandIds.moveGroupDown, (item?: ServerGroupTreeItem) =>
			moveSelectedGroup(serverStore, treeView, item, 'down'),
		),
		vscode.commands.registerCommand(commandIds.moveServerUp, (item?: ServerTreeItem) =>
			moveSelectedServer(serverStore, treeView, item, 'up'),
		),
		vscode.commands.registerCommand(commandIds.moveServerDown, (item?: ServerTreeItem) =>
			moveSelectedServer(serverStore, treeView, item, 'down'),
		),
		vscode.commands.registerCommand(commandIds.moveSelectionUp, () =>
			moveTreeSelection(serverStore, treeView, 'up'),
		),
		vscode.commands.registerCommand(commandIds.moveSelectionDown, () =>
			moveTreeSelection(serverStore, treeView, 'down'),
		),
		vscode.commands.registerCommand(
			commandIds.deleteServer,
			(item: ServerTreeItem, selectedItems?: ServerTreeItem[]) =>
				confirmAndDeleteServers(serverStore, getSelectedServers(item, selectedItems)),
		),
		vscode.commands.registerCommand(commandIds.openSftp, toggleSftpForActiveTerminal),
		vscode.commands.registerCommand(commandIds.searchServers, () =>
			searchServers(treeDataProvider),
		),
		vscode.commands.registerCommand(commandIds.clearServerSearch, () =>
			treeDataProvider.setFilter(''),
		),
		vscode.commands.registerCommand(commandIds.runSshCommand, (item: ServerTreeItem | vscode.Uri) =>
			runSshCommand(serverStore, item),
		),
	);
}

function moveTreeSelection(
	serverStore: ServerStore,
	treeView: vscode.TreeView<ServerGroupTreeItem | ServerTreeItem>,
	direction: 'up' | 'down',
): Promise<void> | undefined {
	const selectedItem = treeView.selection[0];
	return selectedItem instanceof ServerGroupTreeItem
		? serverStore.moveGroup(selectedItem.group, direction)
		: selectedItem instanceof ServerTreeItem
			? serverStore.moveServer(selectedItem.server.id, direction)
			: undefined;
}

function moveSelectedGroup(
	serverStore: ServerStore,
	treeView: vscode.TreeView<ServerGroupTreeItem | ServerTreeItem>,
	item: ServerGroupTreeItem | undefined,
	direction: 'up' | 'down',
): Promise<void> | undefined {
	const selectedItem = item ?? treeView.selection[0];
	if (selectedItem instanceof ServerGroupTreeItem) {
		return serverStore.moveGroup(selectedItem.group, direction);
	}
}

function moveSelectedServer(
	serverStore: ServerStore,
	treeView: vscode.TreeView<ServerGroupTreeItem | ServerTreeItem>,
	item: ServerTreeItem | undefined,
	direction: 'up' | 'down',
): Promise<void> | undefined {
	const selectedItem = item ?? treeView.selection[0];
	if (selectedItem instanceof ServerTreeItem) {
		return serverStore.moveServer(selectedItem.server.id, direction);
	}
}

async function runSshCommand(
	serverStore: ServerStore,
	item: ServerTreeItem | vscode.Uri,
): Promise<void> {
	const server =
		item instanceof ServerTreeItem
			? item.server
			: serverStore
					.getServers()
					.find(candidate => candidate.id === parseEditorDescriptor(item).serverId);
	if (server?.type !== 'ssh') {
		return;
	}
	if (server.commands.length === 0) {
		void vscode.window.showInformationMessage(`No commands are configured for “${server.name}”.`);
		return;
	}
	const selected = await vscode.window.showQuickPick(
		server.commands.map(command => ({ label: command.name, description: command.value, command })),
		{ title: `Run Command on ${server.name}`, placeHolder: 'Select a command to run' },
	);
	if (!selected) {
		return;
	}
	if (runCommandInActiveTerminal(server.id, selected.command.value)) {
		return;
	}
	if (item instanceof vscode.Uri) {
		void vscode.window.showErrorMessage(`The SSH terminal for “${server.name}” is not available.`);
		return;
	}

	queueCommandForTerminal(server.id, selected.command.value);
	try {
		await openServerConnection(server);
	} catch {
		if (!runCommandInActiveTerminal(server.id, selected.command.value)) {
			void vscode.window.showErrorMessage(
				`The SSH terminal for “${server.name}” is not connected.`,
			);
		}
	}
}

function getConnectionAddress(server: Server): string {
	switch (server.type) {
		case 'container':
			return server.connectionType === 'ssh' && 'host' in server
				? server.host
				: server.executablePath;
		case 'mysql':
			return server.host;
		case 'ssh':
			return server.host;
	}
}

function getServerInfo(server: Server): string {
	const type = server.type === 'ssh' ? 'SSH' : server.type === 'mysql' ? 'MySQL' : 'Container';
	return `"${type} ${server.name} ${getConnectionAddress(server)}"`;
}

async function searchServers(treeDataProvider: ServerTreeDataProvider): Promise<void> {
	const filter = await vscode.window.showInputBox({
		title: 'Search Servers',
		prompt: 'Enter search keywords',
		value: treeDataProvider.getFilter(),
		valueSelection: [0, treeDataProvider.getFilter().length],
	});
	if (filter !== undefined) {
		treeDataProvider.setFilter(filter);
	}
}

async function selectAndAddServer(): Promise<void> {
	const selection = await vscode.window.showQuickPick<{
		label: string;
		description: string;
		type: ServerType;
	}>(
		[
			{ label: 'SSH', description: 'Interactive remote terminal', type: 'ssh' },
			{ label: 'MySQL', description: 'Browse tables and preview data', type: 'mysql' },
			{
				label: 'Container',
				description: 'Browse Docker or Podman or Apple Container resources',
				type: 'container',
			},
		],
		{ title: 'Add Server', placeHolder: 'Select a server type' },
	);
	if (selection) {
		await openServerForm(selection.type);
	}
}

async function renameGroup(serverStore: ServerStore, item: ServerGroupTreeItem): Promise<void> {
	const group = await vscode.window.showInputBox({
		title: 'Rename Group',
		prompt: 'Enter a new group name',
		value: item.group,
		valueSelection: [0, item.group.length],
		validateInput: value => {
			const newGroup = value.trim();
			if (!newGroup) {
				return 'Group name is required';
			}
			if (newGroup !== item.group && serverStore.getGroups().includes(newGroup)) {
				return 'A group with this name already exists';
			}
			return undefined;
		},
	});
	const newGroup = group?.trim();
	if (!newGroup || newGroup === item.group) {
		return;
	}

	await serverStore.renameGroup(item.group, newGroup);
}

function getSelectedServers(item: ServerTreeItem, selectedItems?: ServerTreeItem[]): Server[] {
	return (selectedItems?.length ? selectedItems : [item])
		.filter(selectedItem => selectedItem instanceof ServerTreeItem)
		.map(selectedItem => selectedItem.server);
}

async function confirmAndDeleteServers(serverStore: ServerStore, servers: Server[]): Promise<void> {
	const confirmation = await vscode.window.showWarningMessage(
		servers.length === 1
			? `Delete server “${servers[0].name}”?`
			: `Delete ${servers.length} selected servers?`,
		{ modal: true },
		'Delete',
	);
	if (confirmation !== 'Delete') {
		return;
	}

	await serverStore.deleteServers(servers.map(server => server.id));
}
