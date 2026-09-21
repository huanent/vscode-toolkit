import * as vscode from 'vscode';
import { ContainerServer, parseServer } from './server';
import { registerConnectionConfigurations } from '../configuration/tools';
import { ServerStore } from './serverStore';
import { executeContainerCommand } from './containerCommand';

interface ExecuteContainerInput {
	id: string;
	args: string[];
}

export function registerContainerTools(store: ServerStore): vscode.Disposable {
	return vscode.Disposable.from(
		registerConnectionConfigurations('container', store, parseServer),
		vscode.lm.registerTool('runContainerCommand', new ContainerTool(store)),
	);
}

class ContainerTool implements vscode.LanguageModelTool<ExecuteContainerInput> {
	constructor(private readonly serverStore: ServerStore) { }

	prepareInvocation(
		options: vscode.LanguageModelToolInvocationPrepareOptions<ExecuteContainerInput>,
	): vscode.PreparedToolInvocation {
		const server = this.findContainerServer(options.input.id);
		const target = server ? `${server.name} (${server.runtime})` : options.input.id;
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
		const server = this.findContainerServer(options.input.id);
		if (!server)
			throw new Error('Container server was not found. Call readConfigurations first.');
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
