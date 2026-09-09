import * as path from 'node:path';
import * as vscode from 'vscode';
import { getWebviewHtml } from '../../webview';
import { listSshConnections } from '../ssh/connectionService';
import { parseWorkflow, Workflow } from './workflow';

export function registerWorkflowPanel(
	context: vscode.ExtensionContext,
	run: (workflow: Workflow) => Promise<void>,
	showOutput: () => void,
): void {
	let panel: vscode.WebviewPanel | undefined;
	let busy = false;
	const workflows = () => context.globalState.get<Workflow[]>('toolkit.workflows', []);
	const sendState = () =>
		panel?.webview.postMessage({
			type: 'state',
			workflows: workflows(),
			busy,
			servers: listSshConnections().map(server => ({
				id: server.id,
				name: `${server.name} (${server.host})`,
			})),
			cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '',
		});
	context.subscriptions.push(
		vscode.commands.registerCommand('vscode-toolkit.openWorkflow', () => {
			if (panel) {
				panel.reveal();
				void sendState();
				return;
			}
			panel = vscode.window.createWebviewPanel(
				'vscode-toolkit.workflow',
				'Workflow',
				vscode.ViewColumn.One,
				{
					enableScripts: true,
					retainContextWhenHidden: true,
					localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')],
				},
			);
			panel.iconPath = new vscode.ThemeIcon('list-ordered');
			panel.webview.html = getWebviewHtml(panel.webview, context.extensionUri, {
				entry: 'workflow',
				title: 'Workflow',
			});
			const current = panel;
			let mutation: Promise<void> = Promise.resolve();
			const subscription = current.webview.onDidReceiveMessage((message: unknown) => {
				if (!message || typeof message !== 'object') return;
				const request = message as Record<string, unknown>;
				mutation = mutation
					.then(async () => {
						if (request.type === 'ready') {
							await sendState();
							return;
						}
						if (request.type === 'output') {
							showOutput();
							return;
						}
						if (request.type === 'browse') {
							const files = await vscode.window.showOpenDialog({
								canSelectFiles: request.field === 'localPath',
								canSelectFolders: request.field === 'cwd',
								canSelectMany: false,
							});
							if (files?.[0])
								await current.webview.postMessage({
									type: 'path',
									index: request.index,
									field: request.field,
									value: files[0].fsPath,
									draftId: request.draftId,
								});
							return;
						}
						if (busy) throw new Error('Wait for the running workflow to finish.');
						if (request.type === 'save' || request.type === 'run') {
							const workflow = parseWorkflow(request.workflow);
							for (const step of workflow.steps) {
								if (step.type === 'command' && !path.isAbsolute(step.cwd))
									throw new Error('Working directory must be absolute.');
								if (
									step.type === 'sftp' &&
									(!path.isAbsolute(step.localPath) ||
										!path.posix.isAbsolute(step.remotePath) ||
										step.remotePath.endsWith('/'))
								)
									throw new Error('Upload requires absolute local and remote file paths.');
								if (
									step.type !== 'command' &&
									!listSshConnections().some(server => server.id === step.serverId)
								)
									throw new Error('Select an existing SSH connection.');
							}
							const saved = workflows();
							const index = saved.findIndex(candidate => candidate.id === workflow.id);
							if (index < 0) saved.push(workflow);
							else saved[index] = workflow;
							await context.globalState.update('toolkit.workflows', saved);
							await current.webview.postMessage({ type: 'saved', workflow });
							await sendState();
							if (request.type === 'run') {
								busy = true;
								await sendState();
								void run(workflow)
									.catch(error =>
										current.webview.postMessage({
											type: 'error',
											message: error instanceof Error ? error.message : String(error),
										}),
									)
									.finally(() => {
										busy = false;
										void sendState();
									});
							}
						} else if (request.type === 'delete' && typeof request.id === 'string') {
							const target = workflows().find(workflow => workflow.id === request.id);
							if (
								target &&
								(await vscode.window.showWarningMessage(
									`Delete "${target.name}"?`,
									{ modal: true },
									'Delete',
								)) === 'Delete'
							) {
								await context.globalState.update(
									'toolkit.workflows',
									workflows().filter(workflow => workflow.id !== request.id),
								);
								await current.webview.postMessage({ type: 'deleted', id: request.id });
								await sendState();
							}
						}
					})
					.catch(error => {
						void current.webview.postMessage({
							type: 'error',
							message: error instanceof Error ? error.message : String(error),
						});
					});
			});
			current.onDidDispose(() => {
				subscription.dispose();
				panel = undefined;
			});
		}),
	);
	context.subscriptions.push({ dispose: () => panel?.dispose() });
}
