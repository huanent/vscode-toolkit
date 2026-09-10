import * as vscode from 'vscode';
import { dashboardFeaturePanel } from '../dashboard/panel';
import { listSshConnections } from '../ssh/connectionService';
import { parseWorkflow, Workflow } from './workflow';
import { WorkflowStore } from './store';
import { hasWorkflowVariables, validateWorkflowPaths } from './variables';

export function registerWorkflowPanel(
	context: vscode.ExtensionContext,
	store: WorkflowStore,
	run: (workflow: Workflow) => Promise<void>,
	showOutput: () => void,
): void {
	let panel: vscode.WebviewPanel | undefined;
	let busy = false;
	const sendState = async () => {
		try {
			const workflows = await store.list();
			await panel?.webview.postMessage({
				type: 'state',
				workflows,
				locations: Object.fromEntries(workflows.map(workflow => [workflow.id, store.getLocation(workflow.id)])),
				workspaceFolders: store.getWorkspaceFolders(),
				busy,
				servers: listSshConnections().map(server => ({
					id: server.id,
					name: `${server.name} (${server.host})`,
				})),
				cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '',
			});
		} catch (error) {
			void vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
		}
	};
	context.subscriptions.push(
		vscode.commands.registerCommand(
			'vscode-toolkit.openWorkflow',
			(request?: { background?: boolean }) => {
				if (panel) {
					if (!request?.background) panel.reveal();
					void sendState();
					return;
				}
				panel = dashboardFeaturePanel('workflow', request?.background);
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
								validateWorkflowPaths(workflow, true);
								for (const step of workflow.steps) {
									if (
										step.type !== 'command' &&
										!hasWorkflowVariables(step.serverId) &&
										!listSshConnections().some(server => server.id === step.serverId)
									)
										throw new Error('Select an existing SSH connection.');
								}
								await store.save(workflow, typeof request.location === 'string' ? request.location : undefined);
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
								const target = (await store.list()).find(workflow => workflow.id === request.id);
								if (
									target &&
									(await vscode.window.showWarningMessage(
										`Delete "${target.name}"?`,
										{ modal: true },
										'Delete',
									)) === 'Delete'
								) {
									await store.delete(request.id);
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
			},
		),
	);
	context.subscriptions.push({ dispose: () => panel?.dispose() });
}
