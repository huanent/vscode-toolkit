import * as vscode from 'vscode';
import { getStorageUri } from '../../storagePath';
import { parseWorkflow, Workflow } from './workflow';

export class WorkflowStore {
	private readonly directory: vscode.Uri;
	private readonly file: vscode.Uri;
	private mutation: Promise<void> = Promise.resolve();

	constructor(context: vscode.ExtensionContext) {
		this.directory = getStorageUri(context, 'workflow');
		this.file = vscode.Uri.joinPath(this.directory, 'workflows.json');
	}

	list(): Promise<Workflow[]> {
		return this.enqueue(() => this.read());
	}

	save(workflow: Workflow): Promise<void> {
		const saved = parseWorkflow(workflow);
		return this.enqueue(async () => {
			const workflows = await this.read();
			const index = workflows.findIndex(candidate => candidate.id === saved.id);
			if (index < 0) workflows.push(saved);
			else workflows[index] = saved;
			await this.write(workflows);
		});
	}

	delete(id: string): Promise<void> {
		return this.enqueue(async () => {
			await this.write((await this.read()).filter(workflow => workflow.id !== id));
		});
	}

	private enqueue<Result>(operation: () => Promise<Result>): Promise<Result> {
		const pending = this.mutation.then(operation);
		this.mutation = pending.then(
			() => {},
			() => {},
		);
		return pending;
	}

	private async read(): Promise<Workflow[]> {
		let content: Uint8Array;
		try {
			content = await vscode.workspace.fs.readFile(this.file);
		} catch (error) {
			if (!(error instanceof vscode.FileSystemError) || error.code !== 'FileNotFound') throw error;
			return [];
		}
		const workflows: unknown = JSON.parse(Buffer.from(content).toString('utf8'));
		if (!Array.isArray(workflows)) throw new Error('Invalid workflow storage.');
		return workflows.map(parseWorkflow);
	}

	private async write(workflows: Workflow[]): Promise<void> {
		await vscode.workspace.fs.createDirectory(this.directory);
		await vscode.workspace.fs.writeFile(
			this.file,
			Buffer.from(JSON.stringify(workflows, undefined, 2), 'utf8'),
		);
	}
}