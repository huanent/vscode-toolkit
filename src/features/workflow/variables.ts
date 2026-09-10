import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';
import type { Workflow } from './workflow';

export function hasWorkflowVariables(value: string): boolean {
	return /\$\{[^{}]+\}/.test(value);
}

export function resolveWorkflowVariables(workflow: Workflow, location = ''): Workflow {
	const folders = vscode.workspace.workspaceFolders ?? [];
	const folder = folders.find(candidate => candidate.uri.toString() === location)
		?? folders[0];
	const requireFolder = (name?: string) => {
		const selected = name === undefined ? folder : folders.find(candidate => candidate.name === name);
		if (!selected) throw new Error(`Workflow variable requires ${name ? `workspace folder "${name}"` : 'an open workspace folder'}.`);
		return selected.uri.fsPath;
	};
	const resolve = (value: string): string => value.replace(/\$\{([^{}]+)\}/g, (match: string, variable: string) => {
		if (variable.startsWith('env:')) return process.env[variable.slice(4)] ?? '';
		if (variable.startsWith('config:')) {
			const configured = vscode.workspace.getConfiguration(undefined, folder?.uri).get<unknown>(variable.slice(7));
			if (typeof configured !== 'string' && typeof configured !== 'number' && typeof configured !== 'boolean')
				throw new Error(`Workflow variable ${match} must resolve to a string, number or boolean.`);
			return String(configured);
		}
		if (variable.startsWith('workspaceFolder:')) return requireFolder(variable.slice(16));
		switch (variable) {
			case 'workspaceFolder': return requireFolder();
			case 'workspaceFolderBasename': return path.basename(requireFolder());
			case 'userHome': return os.homedir();
			case 'cwd': return process.cwd();
			case 'pathSeparator':
			case '/': return path.sep;
			default:
				if (/^(command|input):/.test(variable)) throw new Error(`Workflow variable ${match} is not supported.`);
				return match;
		}
	});
	return {
		...workflow,
		name: resolve(workflow.name),
		description: workflow.description === undefined ? undefined : resolve(workflow.description),
		steps: workflow.steps.map(step => {
			const name = resolve(step.name);
			if (step.type === 'command') return { ...step, name, command: resolve(step.command), cwd: resolve(step.cwd) };
			const serverId = resolve(step.serverId);
			if (step.type === 'ssh') return { ...step, name, serverId, command: resolve(step.command) };
			return { ...step, name, serverId, localPath: resolve(step.localPath), remotePath: resolve(step.remotePath) };
		}),
	};
}

export function validateWorkflowPaths(workflow: Workflow, allowVariables = false): void {
	for (const step of workflow.steps) {
		const absolute = (value: string, remote = false) =>
			(allowVariables && hasWorkflowVariables(value)) || (remote ? path.posix : path).isAbsolute(value);
		if (step.type === 'command' && !absolute(step.cwd)) throw new Error('Working directory must be absolute.');
		if (step.type === 'sftp' && (!absolute(step.localPath) || !absolute(step.remotePath, true) || step.remotePath.endsWith('/')))
			throw new Error('Upload requires absolute local and remote file paths.');
	}
}