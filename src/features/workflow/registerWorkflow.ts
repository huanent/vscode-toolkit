import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { listSshConnections, resolveSshConnection } from '../ssh/connectionService';
import { executeSshCommand } from '../ssh/sshCommand';
import { writeSftpFile } from '../ssh/sftp';
import { executeWorkflow, Workflow, WorkflowStep } from './workflow';
import { registerWorkflowPanel } from './panel';
import { registerWorkflowTools } from './tools';
import { WorkflowStore } from './store';
import { hasWorkflowVariables, resolveWorkflowVariables, validateWorkflowPaths } from './variables';

export function registerWorkflow(context: vscode.ExtensionContext): void {
	const output = vscode.window.createOutputChannel('Toolkit Workflow');
	let managing = false;
	let running = false;
	const store = new WorkflowStore(context);

	async function run(workflow: Workflow, toolToken?: vscode.CancellationToken, confirm = true, resolved = false): Promise<boolean> {
		if (toolToken?.isCancellationRequested) return false;
		if (!vscode.workspace.isTrusted)
			throw new Error('Trust the workspace before running workflows.');
		if (running) throw new Error('A workflow is already running.');
		if (!workflow.steps.length) throw new Error('Add at least one step before running.');
		if (!resolved) workflow = resolveWorkflowVariables(workflow, store.getLocation(workflow.id));
		validateWorkflowPaths(workflow);
		if (confirm) {
			const confirmed = await vscode.window.showWarningMessage(
				`Run "${workflow.name}"?`,
				{
					modal: true,
					detail: `${workflow.steps.length} steps. Commands run with your permissions.${workflow.steps.some(step => step.type === 'sftp') ? ' Uploads may overwrite remote files.' : ''}`,
				},
				'Run',
			);
			if (confirmed !== 'Run') return false;
		}
		if (toolToken?.isCancellationRequested) return false;
		if (running) throw new Error('A workflow is already running.');
		running = true;
		output.show(true);
		output.appendLine(`\nWorkflow: ${workflow.name}`);
		try {
			await vscode.window.withProgress(
				{ location: vscode.ProgressLocation.Notification, title: workflow.name, cancellable: true },
				async (progress, token) => {
					const cancellation = token.onCancellationRequested(() => {
						output.appendLine('Cancellation requested; waiting for the current step to finish.');
						progress.report({ message: 'Stopping after the current step...' });
					});
					try {
						await executeWorkflow(
							workflow,
							async (step, index) => {
								progress.report({ message: `${index + 1}/${workflow.steps.length}: ${step.name}` });
								output.appendLine(`[${index + 1}/${workflow.steps.length}] ${step.name}`);
								if (step.type === 'command') {
									await new Promise<void>((resolve, reject) => {
										const child = spawn(step.command, {
											shell: true,
											cwd: step.cwd,
											stdio: ['ignore', 'pipe', 'pipe'],
										});
										child.stdout.setEncoding('utf8');
										child.stderr.setEncoding('utf8');
										child.stdout.on('data', (data: string) => output.append(data));
										child.stderr.on('data', (data: string) => output.append(data));
										child.once('error', reject);
										child.once('close', (code, signal) =>
											code === 0
												? resolve()
												: reject(new Error(`Command exited with ${signal ?? code}.`)),
										);
									});
								} else {
									const { server, credentials } = await resolveSshConnection(step.serverId);
									if (step.type === 'ssh')
										output.appendLine(await executeSshCommand(server, credentials, step.command));
									else await writeSftpFile(server, credentials, step.localPath, step.remotePath);
								}
								output.appendLine(`\nCompleted: ${step.name}`);
								progress.report({ increment: 100 / workflow.steps.length });
							},
							() => token.isCancellationRequested || !!toolToken?.isCancellationRequested,
						);
					} finally {
						cancellation.dispose();
					}
				},
			);
			output.appendLine('Workflow completed.');
			void vscode.window.showInformationMessage(`Workflow "${workflow.name}" completed.`);
			return true;
		} catch (error) {
			output.appendLine(`Stopped: ${error instanceof Error ? error.message : String(error)}`);
			throw error;
		} finally {
			running = false;
		}
	}

	async function manage(): Promise<void> {
		while (true) {
			const workflows = await store.list();
			const selected = await vscode.window.showQuickPick(
				[
					{ label: '$(add) New Workflow', workflow: undefined },
					...workflows.map(workflow => ({
						label: workflow.name,
						description: `${workflow.steps.length} steps`,
						workflow,
					})),
				],
				{ title: 'Workflow' },
			);
			if (!selected) return;
			let workflow = selected.workflow;
			if (!workflow) {
				const name = await input('Workflow name');
				if (!name) continue;
				workflow = { id: randomUUID(), name, steps: [] };
				await store.save(workflow);
			}
			while (true) {
				const action = await vscode.window.showQuickPick(
					[
						{ label: '$(play) Run', action: 'run', index: -1 },
						{ label: '$(add) Add Step', action: 'add', index: -1 },
						{ label: '$(edit) Rename', action: 'rename', index: -1 },
						{ label: '$(edit) Edit Description', action: 'description', index: -1 },
						{ label: '$(trash) Delete Workflow', action: 'delete', index: -1 },
						...workflow.steps.map((step, index) => ({
							label: `${index + 1}. ${step.name}`,
							description: describeStep(step),
							action: 'step',
							index,
						})),
					],
					{ title: workflow.name, placeHolder: 'Select a step to edit or reorder' },
				);
				if (!action) break;
				if (action.action === 'run') {
					await run(workflow);
					continue;
				}
				if (action.action === 'add') {
					const step = await editStep();
					if (step) workflow.steps.push(step);
				} else if (action.action === 'rename') {
					const name = await input('Workflow name', workflow.name);
					if (name) workflow.name = name;
				} else if (action.action === 'description') {
					const description = await vscode.window.showInputBox({
						prompt: 'Workflow description',
						value: workflow.description ?? '',
						ignoreFocusOut: true,
					});
					if (description !== undefined) workflow.description = description;
				} else if (action.action === 'delete') {
					if (
						(await vscode.window.showWarningMessage(
							`Delete "${workflow.name}"?`,
							{ modal: true },
							'Delete',
						)) !== 'Delete'
					)
						continue;
					await store.delete(workflow.id);
					break;
				} else {
					const operation = await vscode.window.showQuickPick(
						['Edit', 'Move Up', 'Move Down', 'Delete'],
						{ title: workflow.steps[action.index].name },
					);
					if (operation === 'Edit') {
						const step = await editStep(workflow.steps[action.index]);
						if (step) workflow.steps[action.index] = step;
					} else if (operation === 'Delete') workflow.steps.splice(action.index, 1);
					else if (operation === 'Move Up' || operation === 'Move Down') {
						const target = action.index + (operation === 'Move Up' ? -1 : 1);
						if (target >= 0 && target < workflow.steps.length) {
							[workflow.steps[action.index], workflow.steps[target]] = [
								workflow.steps[target],
								workflow.steps[action.index],
							];
						}
					}
				}
				await store.save(workflow);
			}
		}
	}

	context.subscriptions.push(
		output,
		registerWorkflowTools(store, (workflow, token) => run(workflow, token, false, true)),
		vscode.commands.registerCommand('vscode-toolkit.openWorkflowQuickPick', async () => {
			if (managing) return;
			managing = true;
			try {
				await manage();
			} catch (error) {
				void vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
			} finally {
				managing = false;
			}
		}),
	);
	registerWorkflowPanel(
		context,
		store,
		async workflow => {
			await run(workflow);
		},
		() => output.show(),
	);
}

function input(prompt: string, value = ''): Thenable<string | undefined> {
	return vscode.window.showInputBox({
		prompt,
		value,
		ignoreFocusOut: true,
		validateInput: text => (text.trim() ? undefined : 'Required'),
	});
}

function describeStep(step: WorkflowStep): string {
	if (step.type === 'command') return `Local: ${step.command} (${step.cwd})`;
	const server = listSshConnections().find(candidate => candidate.id === step.serverId);
	const target = server
		? `${server.name} (${server.host})`
		: `Missing SSH connection: ${step.serverId}`;
	return step.type === 'ssh'
		? `SSH ${target}: ${step.command}`
		: `SFTP ${target}: ${step.localPath} -> ${step.remotePath}`;
}

async function editStep(existing?: WorkflowStep): Promise<WorkflowStep | undefined> {
	const choice = await vscode.window.showQuickPick(
		[
			{ label: 'Local Command', type: 'command' as const },
			{ label: 'SSH Command', type: 'ssh' as const },
			{ label: 'SFTP Upload', type: 'sftp' as const },
		],
		{ title: 'Step Type' },
	);
	if (!choice) return;
	const name = await input('Step name', existing?.name ?? choice.label);
	if (!name) return;
	if (choice.type === 'command') {
		const command = await input(
			'Local shell command (non-interactive)',
			existing?.type === 'command' ? existing.command : '',
		);
		if (!command) return;
		const cwd = await vscode.window.showInputBox({
			prompt: 'Absolute working directory',
			value:
				existing?.type === 'command'
					? existing.cwd
					: (vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? ''),
			validateInput: value => (path.isAbsolute(value) || hasWorkflowVariables(value) ? undefined : 'Enter an absolute path or VS Code variable'),
			ignoreFocusOut: true,
		});
		return cwd ? { type: 'command', name, command, cwd } : undefined;
	}
	const servers = listSshConnections();
	if (!servers.length) {
		void vscode.window.showInformationMessage('Create an SSH connection in Toolkit SSH first.');
		return;
	}
	const selected = await vscode.window.showQuickPick(
		servers.map(server => ({
			label: server.name,
			description: `${server.username}@${server.host}:${server.port}`,
			server,
		})),
		{ title: 'SSH Connection' },
	);
	if (!selected) return;
	const serverId = selected.server.id;
	if (choice.type === 'ssh') {
		const command = await input(
			'Remote shell command (non-interactive)',
			existing?.type === 'ssh' ? existing.command : '',
		);
		return command ? { type: 'ssh', name, serverId, command } : undefined;
	}
	const files = await vscode.window.showOpenDialog({
		canSelectMany: false,
		canSelectFiles: true,
		canSelectFolders: false,
		openLabel: 'Upload File',
		defaultUri: existing?.type === 'sftp' ? vscode.Uri.file(existing.localPath) : undefined,
	});
	if (!files?.[0]) return;
	const remotePath = await vscode.window.showInputBox({
		prompt: 'Absolute remote file path (parent directory must exist; existing file is overwritten)',
		value: existing?.type === 'sftp' ? existing.remotePath : '',
		ignoreFocusOut: true,
		validateInput: value =>
			(path.posix.isAbsolute(value) || hasWorkflowVariables(value)) && !value.endsWith('/')
				? undefined
				: 'Enter an absolute remote file path',
	});
	return remotePath
		? { type: 'sftp', name, serverId, localPath: files[0].fsPath, remotePath }
		: undefined;
}
