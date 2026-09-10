import * as vscode from 'vscode';
import { getStorageUri } from '../../storagePath';
import { ConnectionLocations } from '../../connectionLocations';
import { parseWorkflow, Workflow } from './workflow';

export class WorkflowStore {
	private readonly directory: vscode.Uri;
	private readonly locations: ConnectionLocations;
	private mutation: Promise<void> = Promise.resolve();

	constructor(context: vscode.ExtensionContext) {
		this.directory = getStorageUri(context, 'workflow');
		this.locations = new ConnectionLocations(this.directory, 'workflow', '');
	}

	getWorkspaceFolders() { return vscode.workspace.isTrusted ? this.locations.folders : []; }

	getLocation(id: string): string { return this.locations.location(id); }

	list(): Promise<Workflow[]> {
		return this.enqueue(() => this.read());
	}

	save(workflow: Workflow, location?: string): Promise<void> {
		const saved = parseWorkflow(workflow);
		return this.enqueue(async () => {
			const workflows = await this.read();
			if (location !== undefined) this.locations.resolve(location);
			if (!workflows.some(candidate => candidate.id === saved.id)) this.locations.select(saved.id, location);
			const file = this.uriForId(saved.id);
			const directory = this.locations.directory(saved.id);
			await vscode.workspace.fs.createDirectory(directory);
			await vscode.workspace.fs.writeFile(
				file,
				Buffer.from(JSON.stringify(saved, undefined, 2), 'utf8'),
			);
			await this.locations.move(saved.id, `${saved.id}.json`, location);
		});
	}

	delete(id: string): Promise<void> {
		return this.enqueue(async () => {
			await this.read();
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
		const entries = await this.locations.entries();
		const workflows = await Promise.all(
			entries
				.filter(({ name, type }) => type === vscode.FileType.File && name.endsWith('.json'))
				.sort((left, right) => left.name.localeCompare(right.name))
				.map(async ({ name, directory }) => {
					const id = name.slice(0, -5);
					const content = await vscode.workspace.fs.readFile(vscode.Uri.joinPath(directory, name));
					const value: unknown = JSON.parse(Buffer.from(content).toString('utf8'));
					if (!value || typeof value !== 'object' || Array.isArray(value) ||
						!('id' in value) || value.id !== id) return undefined;
					let workflow: Workflow;
					try {
						workflow = parseWorkflow(value);
					} catch (error) {
						throw new Error(`Invalid workflow file ${name}: ${error instanceof Error ? error.message : String(error)}`);
					}
					return { workflow, directory };
				}),
		);
		const storedWorkflows = workflows.filter(workflow => workflow !== undefined);
		const ids = new Set<string>();
		for (const { workflow } of storedWorkflows) {
			if (ids.has(workflow.id)) throw new Error('Duplicate workflow ID across storage locations.');
			ids.add(workflow.id);
		}
		for (const { workflow, directory } of storedWorkflows) this.locations.remember(workflow.id, directory);
		return storedWorkflows.map(({ workflow }) => workflow);
	}

	private uriForId(id: string): vscode.Uri {
		if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error('Invalid workflow ID.');
		return vscode.Uri.joinPath(this.locations.directory(id), `${id}.json`);
	}
}