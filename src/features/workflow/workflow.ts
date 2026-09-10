export type WorkflowStep =
	| { name: string; type: 'command'; command: string; cwd: string }
	| { name: string; type: 'ssh'; serverId: string; command: string }
	| { name: string; type: 'sftp'; serverId: string; localPath: string; remotePath: string };

export interface Workflow {
	id: string;
	name: string;
	description?: string;
	steps: WorkflowStep[];
}

export function parseWorkflow(value: unknown): Workflow {
	if (!value || typeof value !== 'object') throw new Error('Invalid workflow.');
	const record = value as Record<string, unknown>;
	const text = (source: Record<string, unknown>, key: string): string => {
		const field = source[key];
		if (typeof field !== 'string' || !field.trim()) throw new Error(`${key} is required.`);
		return field;
	};
	if (!Array.isArray(record.steps)) throw new Error('Invalid steps.');
	const description = (source: Record<string, unknown>): string => {
		if (source.description === undefined) return '';
		if (typeof source.description !== 'string') throw new Error('description must be a string.');
		return source.description;
	};
	return {
		id: text(record, 'id'),
		name: text(record, 'name'),
		description: description(record),
		steps: record.steps.map((value): WorkflowStep => {
			if (!value || typeof value !== 'object') throw new Error('Invalid step.');
			const step = value as Record<string, unknown>;
			const name = text(step, 'name');
			if (step.type === 'command')
				return {
					name,
					type: 'command',
					command: text(step, 'command'),
					cwd: text(step, 'cwd'),
				};
			if (step.type === 'ssh')
				return {
					name,
					type: 'ssh',
					serverId: text(step, 'serverId'),
					command: text(step, 'command'),
				};
			if (step.type === 'sftp')
				return {
					name,
					type: 'sftp',
					serverId: text(step, 'serverId'),
					localPath: text(step, 'localPath'),
					remotePath: text(step, 'remotePath'),
				};
			throw new Error('Invalid step type.');
		}),
	};
}

export async function executeWorkflow(
	workflow: Workflow,
	execute: (step: WorkflowStep, index: number) => Promise<void>,
	isCancelled: () => boolean,
): Promise<void> {
	if (!workflow.steps.length) throw new Error('Add at least one step before running.');
	for (const [index, step] of workflow.steps.entries()) {
		if (isCancelled()) throw new Error('Workflow cancelled.');
		await execute(step, index);
	}
	if (isCancelled()) throw new Error('Workflow cancelled.');
}
