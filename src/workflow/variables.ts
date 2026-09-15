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
	const requireFolder = () => {
		if (!folder) throw new Error('Workflow variable requires an open workspace folder.');
		return folder.uri.fsPath;
	};
	const resolve = (value: string): string => value.replace(/\$\{([^{}]+)\}/g, (match: string, variable: string) => {
		if (variable.startsWith('env:')) return process.env[variable.slice(4)] ?? '';
		switch (variable) {
			case 'workspaceFolder': return requireFolder();
			case 'userHome': return os.homedir();
			case 'cwd': return process.cwd();
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
		if (step.type !== 'sftp') continue;
		if (!absolute(step.remotePath, true)) throw new Error('SFTP requires an absolute remote path.');
		if (!step.localPath || !absolute(step.localPath) || step.remotePath.endsWith('/') || step.localPath.endsWith(path.sep))
			throw new Error('Transfer requires absolute local and remote file paths.');
	}
}