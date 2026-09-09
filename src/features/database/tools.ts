import * as vscode from 'vscode';
import { MysqlServer } from './server';
import { ServerStore } from './serverStore';
import { createMysqlConnection } from './mysql/mysqlConnection';

interface ExecuteSqlInput {
	serverId: string;
	database?: string;
	sql: string;
}

export function registerDatabaseTools(store: ServerStore): vscode.Disposable {
	return vscode.Disposable.from(
		vscode.lm.registerTool('database_list_connections', {
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
		vscode.lm.registerTool('servers_sql', new SqlTool(store)),
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
		if (!server) throw new Error('DB server was not found. Call database_list_connections first.');
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

function textResult(value: string): vscode.LanguageModelToolResult {
	return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(value)]);
}
