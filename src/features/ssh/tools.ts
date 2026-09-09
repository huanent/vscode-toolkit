import * as vscode from 'vscode';
import { SshServer } from './server';
import { ServerStore } from './serverStore';
import { executeSshCommand } from './sshCommand';
import {
	createSftpDirectory,
	deleteSftpEntry,
	downloadSftpFile,
	listSftpDirectory,
	readSftpFile,
	renameSftpEntry,
	writeSftpFile,
} from './sftp';

interface SftpInput {
	serverId: string;
	action: 'list' | 'read' | 'upload' | 'download' | 'delete' | 'mkdir' | 'rename';
	remotePath: string;
	localPath?: string;
	toRemotePath?: string;
	isDirectory?: boolean;
}

interface ExecuteSshCommandInput {
	serverId: string;
	command: string;
}

export function registerSshTools(store: ServerStore): vscode.Disposable {
	return vscode.Disposable.from(
		vscode.lm.registerTool('ssh_list_connections', {
			async invoke() {
				return textResult(
					JSON.stringify(
						store.getServers().filter(server => server.aiEnabled),
						undefined,
						2,
					),
				);
			},
		}),
		vscode.lm.registerTool('servers_sftp', new SftpTool(store)),
		vscode.lm.registerTool('servers_ssh', new ExecuteSshCommandTool(store)),
	);
}

class SftpTool implements vscode.LanguageModelTool<SftpInput> {
	constructor(private readonly serverStore: ServerStore) {}

	prepareInvocation(
		options: vscode.LanguageModelToolInvocationPrepareOptions<SftpInput>,
	): vscode.PreparedToolInvocation {
		const server = this.findSshServer(options.input.serverId);
		const target = server
			? `${server.name} (${server.username}@${server.host}:${server.port})`
			: options.input.serverId;
		return {
			invocationMessage: `Using SFTP to ${options.input.action} ${options.input.remotePath} on ${target}`,
			confirmationMessages: {
				title: 'Allow SFTP file operation?',
				message: new vscode.MarkdownString(
					`Run SFTP **${options.input.action}** on **${target}** for \`${options.input.remotePath}\`?`,
				),
			},
		};
	}

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<SftpInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.LanguageModelToolResult> {
		const input = options.input;
		const server = this.findSshServer(input.serverId);
		if (!server) throw new Error('SSH server was not found. Call ssh_list_connections first.');
		const credentials = await this.serverStore.getCredentials(server.id);
		switch (input.action) {
			case 'list':
				return textResult(
					JSON.stringify(
						await listSftpDirectory(server, credentials, input.remotePath),
						undefined,
						2,
					),
				);
			case 'read':
				return textResult(
					(await readSftpFile(server, credentials, input.remotePath)).slice(0, 20_000),
				);
			case 'upload':
				if (!input.localPath) throw new Error('localPath is required for upload.');
				await writeSftpFile(server, credentials, input.localPath, input.remotePath);
				return textResult(`Uploaded ${input.localPath} to ${input.remotePath}.`);
			case 'download':
				if (!input.localPath) throw new Error('localPath is required for download.');
				await downloadSftpFile(server, credentials, input.remotePath, input.localPath);
				return textResult(`Downloaded ${input.remotePath} to ${input.localPath}.`);
			case 'delete':
				await deleteSftpEntry(server, credentials, input.remotePath, input.isDirectory ?? false);
				return textResult(`Deleted ${input.remotePath}.`);
			case 'mkdir':
				await createSftpDirectory(server, credentials, input.remotePath);
				return textResult(`Created directory ${input.remotePath}.`);
			case 'rename':
				if (!input.toRemotePath) throw new Error('toRemotePath is required for rename.');
				await renameSftpEntry(server, credentials, input.remotePath, input.toRemotePath);
				return textResult(`Renamed ${input.remotePath} to ${input.toRemotePath}.`);
		}
	}

	private findSshServer(serverId: string): SshServer | undefined {
		return this.serverStore
			.getServers()
			.find(
				(server): server is SshServer =>
					server.id === serverId && server.type === 'ssh' && server.aiEnabled,
			);
	}
}

class ExecuteSshCommandTool implements vscode.LanguageModelTool<ExecuteSshCommandInput> {
	constructor(private readonly serverStore: ServerStore) {}

	prepareInvocation(
		options: vscode.LanguageModelToolInvocationPrepareOptions<ExecuteSshCommandInput>,
	): vscode.PreparedToolInvocation {
		const server = this.findSshServer(options.input.serverId);
		const target = server
			? `${server.name} (${server.username}@${server.host}:${server.port})`
			: options.input.serverId;
		return {
			invocationMessage: `Executing SSH command on ${target}`,
			confirmationMessages: {
				title: 'Allow SSH command?',
				message: new vscode.MarkdownString(`Run \`${options.input.command}\` on **${target}**?`),
			},
		};
	}

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<ExecuteSshCommandInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.LanguageModelToolResult> {
		const server = this.findSshServer(options.input.serverId);
		if (!server) {
			throw new Error('SSH server was not found. Call ssh_list_connections first.');
		}

		const credentials = await this.serverStore.getCredentials(server.id);
		const output = await executeSshCommand(server, credentials, options.input.command);
		return textResult(output.slice(0, 20_000));
	}

	private findSshServer(serverId: string): SshServer | undefined {
		return this.serverStore
			.getServers()
			.find(
				(server): server is SshServer =>
					server.id === serverId && server.type === 'ssh' && server.aiEnabled,
			);
	}
}

function textResult(value: string): vscode.LanguageModelToolResult {
	return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(value)]);
}
