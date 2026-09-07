import * as vscode from 'vscode';

export class FeatureTreeProvider
	implements vscode.TreeDataProvider<vscode.TreeItem>, vscode.Disposable
{
	static readonly viewType = 'vscode-toolkit.features';
	private readonly changeEmitter = new vscode.EventEmitter<void>();
	readonly onDidChangeTreeData = this.changeEmitter.event;

	getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
		return element;
	}

	async getChildren(): Promise<vscode.TreeItem[]> {
		const items: vscode.TreeItem[] = [];
		const chatItem = new vscode.TreeItem('Chat', vscode.TreeItemCollapsibleState.None);
		chatItem.description = 'Open chat';
		chatItem.iconPath = new vscode.ThemeIcon('comment-discussion');
		chatItem.command = {
			command: 'vscode-toolkit.openChat',
			title: 'Open Chat',
		};
		items.push(chatItem);

		const explorerItem = new vscode.TreeItem('Explorer', vscode.TreeItemCollapsibleState.None);
		explorerItem.description = 'Browse files';
		explorerItem.iconPath = new vscode.ThemeIcon('files');
		explorerItem.command = {
			command: 'vscode-toolkit.openExplorer',
			title: 'Open Explorer',
		};
		items.push(explorerItem);

		const httpClientItem = new vscode.TreeItem('HTTP Client', vscode.TreeItemCollapsibleState.None);
		httpClientItem.description = 'Open last request';
		httpClientItem.iconPath = new vscode.ThemeIcon('globe');
		httpClientItem.command = {
			command: 'vscode-toolkit.openHttpClient',
			title: 'Open HTTP Client',
		};
		items.push(httpClientItem);

		if (process.platform === 'darwin') {
			const launchdItem = new vscode.TreeItem('LaunchAgents', vscode.TreeItemCollapsibleState.None);
			launchdItem.description = 'Manage startup items';
			launchdItem.iconPath = new vscode.ThemeIcon('server-process');
			launchdItem.command = {
				command: 'vscode-toolkit.openLaunchd',
				title: 'Open LaunchAgents',
			};
			items.push(launchdItem);
		}
		return items;
	}

	dispose(): void {
		this.changeEmitter.dispose();
	}
}
