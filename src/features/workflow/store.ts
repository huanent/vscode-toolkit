import * as vscode from 'vscode';
import { getStorageUri } from '../../storagePath';
import { parseWorkflow, Workflow } from './workflow';

export class WorkflowStore {
	private readonly directory: vscode.Uri;
	private mutation: Promise<void> = Promise.resolve();

	constructor(context: vscode.ExtensionContext) {
		this.directory = getStorageUri(context, 'workflow');
	}

	list(): Promise<Workflow[]> {
		return this.enqueue(() => this.read());
	}

	save(workflow: Workflow): Promise<void> {
		const saved = parseWorkflow(workflow);
		return this.enqueue(async () => {
			const file = this.uriForId(saved.id);
			await vscode.workspace.fs.createDirectory(this.directory);
			await vscode.workspace.fs.writeFile(
				file,
				Buffer.from(JSON.stringify(saved, undefined, 2), 'utf8'),
			);
		});
	}

	delete(id: string): Promise<void> {
		return this.enqueue(async () => {
			try {
				await vscode.workspace.fs.delete(this.uriForId(id), { recursive: false, useTrash: false });
			} catch (error) {
				if (!(error instanceof vscode.FileSystemError) || error.code !== 'FileNotFound') throw error;
			}
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
		let entries: [string, vscode.FileType][];
		try {
			entries = await vscode.workspace.fs.readDirectory(this.directory);
		} catch (error) {
			if (!(error instanceof vscode.FileSystemError) || error.code !== 'FileNotFound') throw error;
			return [];
		}
		return Promise.all(
			entries
				.filter(([name, type]) => type === vscode.FileType.File && name.endsWith('.json'))
				.sort(([left], [right]) => left.localeCompare(right))
				.map(async ([name]) => {
					const id = name.slice(0, -5);
					const content = await vscode.workspace.fs.readFile(this.uriForId(id));
					const workflow = parseWorkflow(JSON.parse(Buffer.from(content).toString('utf8')));
					if (workflow.id !== id) throw new Error(`Workflow ID does not match file: ${name}`);
					return workflow;
				}),
		);
	}

	private uriForId(id: string): vscode.Uri {
		if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error('Invalid workflow ID.');
		return vscode.Uri.joinPath(this.directory, `${id}.json`);
	}
}