import { randomUUID } from 'node:crypto';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { listSshConnections } from '../ssh/connectionService';
import { parseWorkflow, Workflow } from './workflow';

interface UpsertWorkflowInput {
	id?: string;
	name: string;
	description?: string;
	steps: Workflow['steps'];
}

export function registerWorkflowTools(
	context: vscode.ExtensionContext,
	run: (workflow: Workflow, token?: vscode.CancellationToken) => Promise<boolean>,
): vscode.Disposable {
	const list = () => structuredClone(context.globalState.get<Workflow[]>('toolkit.workflows', []));
	const result = (value: unknown) =>
		new vscode.LanguageModelToolResult([
			new vscode.LanguageModelTextPart(JSON.stringify(value, undefined, 2)),
		]);
	const validate = (workflow: Workflow) => {
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
				!listSshConnections().some(server => server.id === step.serverId && server.aiEnabled)
			)
				throw new Error('SSH connection is not enabled for AI. Call listSSHServers first.');
		}
	};
	let mutation: Promise<void> = Promise.resolve();
	return vscode.Disposable.from(
		vscode.lm.registerTool('listWorkflows', {
			invoke() {
				return result(
					list().map(workflow => ({
						id: workflow.id,
						name: workflow.name,
						description: workflow.description ?? '',
						stepCount: workflow.steps.length,
					})),
				);
			},
		}),
		vscode.lm.registerTool<{ id: string }>('getWorkflow', {
			invoke(options) {
				const workflow = list().find(candidate => candidate.id === options.input.id);
				if (!workflow) throw new Error('Workflow was not found. Call listWorkflows first.');
				return result(parseWorkflow(workflow));
			},
		}),
		vscode.lm.registerTool<UpsertWorkflowInput>('upsertWorkflow', {
			prepareInvocation(options) {
				return {
					invocationMessage: `Saving workflow ${options.input.name}`,
					confirmationMessages: {
						title: 'Save workflow?',
						message: `Create or replace this workflow without executing it:\n${JSON.stringify(options.input, undefined, 2)}`,
					},
				};
			},
			async invoke(options, token) {
				const workflow = parseWorkflow({ ...options.input, id: options.input.id ?? randomUUID() });
				const save = mutation.then(async () => {
					if (token.isCancellationRequested) throw new Error('Workflow save cancelled.');
					validate(workflow);
					const workflows = list();
					const index = workflows.findIndex(candidate => candidate.id === workflow.id);
					if (index < 0) workflows.push(workflow);
					else workflows[index] = workflow;
					await context.globalState.update('toolkit.workflows', workflows);
				});
				mutation = save.catch(() => {});
				await save;
				return result(workflow);
			},
		}),
		vscode.lm.registerTool<{ id: string }>('runWorkflow', {
			async invoke(options, token) {
				const saved = list().find(workflow => workflow.id === options.input.id);
				if (!saved) throw new Error('Workflow was not found. Call listWorkflows first.');
				const workflow = parseWorkflow(saved);
				validate(workflow);
				const completed = await run(workflow, token);
				return result({ id: workflow.id, status: completed ? 'completed' : 'cancelled' });
			},
		}),
	);
}
