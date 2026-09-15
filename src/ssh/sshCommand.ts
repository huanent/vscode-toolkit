import { SshServer } from './server';
import { ServerCredentials } from './serverStore';
import { connectSshClient, SshConnection } from './sshConnection';

function buildRemoteCommand(command: string): string {
	const quote = (value: string) => `'${value.replace(/'/g, `'\\''`)}'`;
	const shell = '"${SHELL:-/bin/sh}"';
	const script = `exec ${shell} -c ${quote(command)}`;
	return `exec ${shell} -ilc ${quote(script)}`;
}

export function executeSshCommand(
	server: SshServer,
	credentials: ServerCredentials,
	command: string,
): Promise<string> {
	return new Promise((resolve, reject) => {
		let settled = false;
		let connection: SshConnection | undefined;

		const finish = (error?: Error, output = '') => {
			if (settled) {
				return;
			}
			settled = true;
			connection?.dispose();
			if (error) {
				reject(error);
			} else {
				resolve(output.trim());
			}
		};

		connectSshClient(
			server,
			credentials,
			nextConnection => {
				connection = nextConnection;
				nextConnection.client.exec(buildRemoteCommand(command), (error, stream) => {
					if (error) {
						finish(error);
						return;
					}
					let stdout = '';
					let stderr = '';
					stream.setEncoding('utf8');
					stream.stderr.setEncoding('utf8');
					stream.on('data', (data: Buffer | string) => (stdout += data.toString()));
					stream.stderr.on('data', data => (stderr += data));
					stream.on('close', (code: number | undefined) => {
						if (code && code !== 0) {
							const output = [stdout.trim(), stderr.trim()].filter(Boolean).join('\n');
							finish(new Error(`Remote command exited with code ${code}.${output ? `\n${output}` : ''}`));
							return;
						}
						finish(undefined, stdout);
					});
				});
			},
			finish,
		);
	});
}
