import { configurations, validateConfigurationFields } from '../configuration/tools';
import * as vscode from 'vscode';
import { listSshConnections } from '../ssh/connectionService';
import { parseWorkflow, Workflow } from './workflow';
import { WorkflowStore } from './store';
import { hasWorkflowVariables, resolveWorkflowVariables, validateWorkflowPaths } from './variables';

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
				throw new Error('SSH connection is not enabled for AI. Call readConfigrations first.');
		}
	};
	const save = async (configuration: Record<string, unknown>, location?: string) => {
		const workflow = parseWorkflow(configuration);
		validateConfigurationFields(configuration, workflow);
		validate(workflow, true);
		await store.save(workflow, location);
		return { type: 'workflow' as const, id: workflow.id, location: store.getLocation(workflow.id), configuration: { ...workflow } };
	};
	return vscode.Disposable.from(
		new vscode.Disposable(configurations.register('workflow', {
			async create(configuration, location) {
				if ((await store.list()).some(workflow => workflow.id === configuration.id)) throw new Error('Configuration ID already exists.');
				return save(configuration, location);
			},
			async list() {
				return (await store.list()).map(workflow => ({
					type: 'workflow', id: workflow.id, location: store.getLocation(workflow.id),
					configuration: { ...parseWorkflow(workflow) },
				}));
			},
			async update(_entry, configuration, location) {
				return save(configuration, location);
			},
		})),
		vscode.lm.registerTool<{ id: string }>('runWorkflow', {
			async invoke(options, token) {
				const saved = (await store.list()).find(workflow => workflow.id === options.input.id);
				if (!saved) throw new Error('Workflow was not found. Call readConfigrations first.');
				const workflow = resolveWorkflowVariables(parseWorkflow(saved), store.getLocation(saved.id));
				validate(workflow);
				const completed = await run(workflow, token);
				return result({ id: workflow.id, status: completed ? 'completed' : 'cancelled' });
			},
		}),
	);
}
