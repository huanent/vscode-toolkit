import * as vscode from 'vscode';
import { executeContainerCommand } from '../containers/containerEditor';
import { createMysqlConnection } from '../mysql/mysqlConnection';
import { Server, ContainerServer, MysqlServer, SshServer } from '../servers/server';
import { ServerStore } from '../servers/serverStore';
import { executeSshCommand } from '../ssh/sshCommand';
import {
	createSftpDirectory,
	deleteSftpEntry,
	downloadSftpFile,
	listSftpDirectory,
	readSftpFile,
	renameSftpEntry,
	writeSftpFile,
} from '../ssh/sftp';

interface ListServersInput {
	serverType: 'ssh' | 'db' | 'container';
}

interface ExecuteSshCommandInput {
	serverId: string;
	command: string;
}

interface ExecuteSqlInput {
	serverId: string;
	database?: string;
	sql: string;
}

interface ExecuteContainerInput {
	serverId: string;
	args: string[];
}

interface SftpInput {
	serverId: string;
	action: 'list' | 'read' | 'upload' | 'download' | 'delete' | 'mkdir' | 'rename';
	remotePath: string;
	localPath?: string;
	toRemotePath?: string;
	isDirectory?: boolean;
}

export function registerServersTools(serverStore: ServerStore): vscode.Disposable {
	return vscode.Disposable.from(
		vscode.lm.registerTool('servers_list_servers', new ListServersTool(serverStore)),
		vscode.lm.registerTool('servers_ssh', new ExecuteSshCommandTool(serverStore)),
		vscode.lm.registerTool('servers_sql', new SqlTool(serverStore)),
		vscode.lm.registerTool('servers_container', new ContainerTool(serverStore)),
		vscode.lm.registerTool('servers_sftp', new SftpTool(serverStore)),
	);
}

class SqlTool implements vscode.LanguageModelTool<ExecuteSqlInput> {
	constructor(private readonly serverStore: ServerStore) {}

	prepareInvocation(
		options: vscode.LanguageModelToolInvocationPrepareOptions<ExecuteSqlInput>,
	): vscode.PreparedToolInvocation {
		const server = this.findMysqlServer(options.input.serverId);
		const target = server
			? `${server.name} (${server.host}:${server.port})`
			: options.input.serverId;
		return {
			invocationMessage: `Executing SQL on ${target}`,
			confirmationMessages: {
				title: 'Allow SQL query?',
				message: new vscode.MarkdownString(
					`Run SQL on **${target}**?\n\n\`${options.input.sql.slice(0, 500)}\``,
				),
			},
		};
	}

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<ExecuteSqlInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.LanguageModelToolResult> {
		const server = this.findMysqlServer(options.input.serverId);
		if (!server)
			throw new Error(
				'DB server was not found. Call servers_list_servers with serverType db first.',
			);
		const credentials = await this.serverStore.getCredentials(server.id);
		const connection = await createMysqlConnection(server, credentials, options.input.database);
		try {
			const [result] = await connection.query(options.input.sql);
			return textResult(JSON.stringify(result, undefined, 2));
		} finally {
			await connection.end();
		}
	}

	private findMysqlServer(serverId: string): MysqlServer | undefined {
		return this.serverStore
			.getServers()
			.find(
				(server): server is MysqlServer =>
					server.id === serverId && server.type === 'mysql' && server.aiEnabled,
			);
	}
}

class ContainerTool implements vscode.LanguageModelTool<ExecuteContainerInput> {
	constructor(private readonly serverStore: ServerStore) {}

	prepareInvocation(
		options: vscode.LanguageModelToolInvocationPrepareOptions<ExecuteContainerInput>,
	): vscode.PreparedToolInvocation {
		const server = this.findContainerServer(options.input.serverId);
		const target = server ? `${server.name} (${server.runtime})` : options.input.serverId;
		return {
			invocationMessage: `Executing container command on ${target}`,
			confirmationMessages: {
				title: 'Allow container command?',
				message: new vscode.MarkdownString(
					`Run container command **${options.input.args.join(' ')}** on **${target}**?`,
				),
			},
		};
	}

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<ExecuteContainerInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.LanguageModelToolResult> {
		const server = this.findContainerServer(options.input.serverId);
		if (!server)
			throw new Error(
				'Container server was not found. Call servers_list_servers with serverType container first.',
			);
		const output = await executeContainerCommand(server, this.serverStore, options.input.args);
		return textResult(output.slice(0, 20_000));
	}

	private findContainerServer(serverId: string): ContainerServer | undefined {
		return this.serverStore
			.getServers()
			.find(
				(server): server is ContainerServer =>
					server.id === serverId && server.type === 'container' && server.aiEnabled,
			);
	}
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
		if (!server) throw new Error('SSH server was not found. Call servers_list_servers first.');
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

class ListServersTool implements vscode.LanguageModelTool<ListServersInput> {
	constructor(private readonly serverStore: ServerStore) {}

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<ListServersInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.LanguageModelToolResult> {
		const servers = this.serverStore
			.getServers()
			.filter(server => server.aiEnabled && this.matchesType(server, options.input.serverType))
			.map(server => this.toListedServer(server));

		return textResult(JSON.stringify(servers, undefined, 2));
	}

	private matchesType(server: Server, serverType: ListServersInput['serverType']): boolean {
		return serverType === 'db' ? server.type === 'mysql' : server.type === serverType;
	}

	private toListedServer(server: Server): Record<string, unknown> {
		const result: Record<string, unknown> = {
			id: server.id,
			name: server.name,
			type: server.type === 'mysql' ? 'db' : server.type,
			group: server.group,
		};
		if (server.type === 'ssh' || server.type === 'mysql') {
			result.host = server.host;
			result.port = server.port;
			result.username = server.username;
		}
		if (server.type === 'mysql') {
			result.database = server.database;
		}
		if (server.type === 'container') {
			result.runtime = server.runtime;
			result.connectionType = server.connectionType;
		}
		return result;
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
			throw new Error('SSH server was not found. Call servers_list_servers first.');
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
