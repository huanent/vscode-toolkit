import { randomUUID } from 'node:crypto';
import * as vscode from 'vscode';
import { listSshConnections } from '../ssh/connectionService';
import { parseWorkflow, Workflow } from './workflow';
import { WorkflowStore } from './store';
import { hasWorkflowVariables, resolveWorkflowVariables, validateWorkflowPaths } from './variables';

interface UpsertWorkflowInput {
	id?: string;
	location?: string;
	name: string;
	description?: string;
	steps: Workflow['steps'];
}

export function registerWorkflowTools(
	store: WorkflowStore,
	run: (workflow: Workflow, token?: vscode.CancellationToken) => Promise<boolean>,
): vscode.Disposable {
	const result = (value: unknown) =>
		new vscode.LanguageModelToolResult([
			new vscode.LanguageModelTextPart(JSON.stringify(value, undefined, 2)),
		]);
	const validate = (workflow: Workflow, allowVariables = false) => {
		validateWorkflowPaths(workflow, allowVariables);
		for (const step of workflow.steps) {
			if (
				step.type !== 'command' &&
				!(allowVariables && hasWorkflowVariables(step.serverId)) &&
				!listSshConnections().some(server => server.id === step.serverId && server.aiEnabled)
			)
				throw new Error('SSH connection is not enabled for AI. Call listSSHServers first.');
		}
	};
	let mutation: Promise<void> = Promise.resolve();
	return vscode.Disposable.from(
		vscode.lm.registerTool('listWorkflows', {
			async invoke() {
				return result(
					(await store.list()).map(workflow => ({
						id: workflow.id,
						name: workflow.name,
						description: workflow.description ?? '',
						stepCount: workflow.steps.length,
						location: store.getLocation(workflow.id),
					})),
				);
			},
		}),
		vscode.lm.registerTool<{ id: string }>('getWorkflow', {
			async invoke(options) {
				const workflow = (await store.list()).find(candidate => candidate.id === options.input.id);
				if (!workflow) throw new Error('Workflow was not found. Call listWorkflows first.');
				return result({ ...parseWorkflow(workflow), location: store.getLocation(workflow.id) });
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
				if (options.input.location !== undefined && typeof options.input.location !== 'string')
					throw new Error('location must be a string.');
				const workflow = parseWorkflow({ ...options.input, id: options.input.id ?? randomUUID() });
				const save = mutation.then(async () => {
					if (token.isCancellationRequested) throw new Error('Workflow save cancelled.');
					validate(workflow, true);
					await store.save(workflow, options.input.location);
				});
				mutation = save.catch(() => {});
				await save;
				return result({ ...workflow, location: store.getLocation(workflow.id) });
			},
		}),
		vscode.lm.registerTool<{ id: string }>('runWorkflow', {
			async invoke(options, token) {
				const saved = (await store.list()).find(workflow => workflow.id === options.input.id);
				if (!saved) throw new Error('Workflow was not found. Call listWorkflows first.');
				const workflow = resolveWorkflowVariables(parseWorkflow(saved), store.getLocation(saved.id));
				validate(workflow);
				const completed = await run(workflow, token);
				return result({ id: workflow.id, status: completed ? 'completed' : 'cancelled' });
			},
		}),
	);
}
