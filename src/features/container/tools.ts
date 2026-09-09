import * as vscode from 'vscode';
import { ContainerServer } from './server';
import { ServerStore } from './serverStore';
import { executeContainerCommand } from './containerCommand';

interface ExecuteContainerInput {
	serverId: string;
	args: string[];
}

export function registerContainerTools(store: ServerStore): vscode.Disposable {
	return vscode.Disposable.from(
		vscode.lm.registerTool('container_list_connections', {
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
		vscode.lm.registerTool('servers_container', new ContainerTool(store)),
	);
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
			throw new Error('Container server was not found. Call container_list_connections first.');
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

function textResult(value: string): vscode.LanguageModelToolResult {
	return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(value)]);
}
