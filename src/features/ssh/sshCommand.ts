import { SshServer } from './server';
import { ServerCredentials } from './serverStore';
import { connectSshClient, SshConnection } from './sshConnection';
import type { ClientChannel } from 'ssh2';

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
	signal?: AbortSignal,
	onOutput?: (text: string) => void,
	options: { pty?: boolean } = {},
): Promise<string> {
	return new Promise((resolve, reject) => {
		let settled = false;
		let connection: SshConnection | undefined;
		let channel: ClientChannel | undefined;
		let disconnect: (() => void) | undefined;
		let cancellationTimer: ReturnType<typeof setTimeout> | undefined;
		const cancelled = () => new DOMException('SSH command cancelled.', 'AbortError');

		const finish = (error?: Error, output = '') => {
			if (settled) {
				return;
			}
			settled = true;
			clearTimeout(cancellationTimer);
			signal?.removeEventListener('abort', abort);
			if (disconnect) disconnect();
			else connection?.dispose();
			if (signal?.aborted && error?.name !== 'SshCancellationUnconfirmedError') error = cancelled();
			if (error) {
				reject(error);
			} else {
				resolve(output.trim());
			}
		};

		const abort = () => {
			if (settled) return;
			if (!channel) {
				finish(cancelled());
				return;
			}
			cancellationTimer = setTimeout(() => {
				if (options.pty) {
					const error = new Error('Ctrl+C was sent, but remote process termination could not be confirmed. Check the remote host before retrying.');
					error.name = 'SshCancellationUnconfirmedError';
					finish(error);
					return;
				}
				try { channel?.signal('KILL'); } catch { }
				finish(cancelled());
			}, options.pty ? 10000 : 2000);
			try {
				if (options.pty) channel.write('\x03');
				else channel.signal('TERM');
			} catch {
				if (options.pty) {
					const error = new Error('Unable to send Ctrl+C; remote process termination could not be confirmed.');
					error.name = 'SshCancellationUnconfirmedError';
					finish(error);
				} else finish(cancelled());
			}
		};
		if (signal?.aborted) {
			finish(cancelled());
			return;
		}
		signal?.addEventListener('abort', abort, { once: true });
		disconnect = connectSshClient(
			server,
			credentials,
			nextConnection => {
				if (settled) {
					nextConnection.dispose();
					return;
				}
				connection = nextConnection;
				nextConnection.client.exec(buildRemoteCommand(command), options.pty ? {
					pty: { term: 'dumb', cols: 120, rows: 30, modes: { ISIG: 1, VINTR: 3, ECHO: 0 } },
				} : {}, (error, stream) => {
					if (settled) {
						stream?.close();
						return;
					}
					if (error) {
						finish(error);
						return;
					}
					let stdout = '';
					channel = stream;
					stream.on('error', finish);
					let stderr = '';
					stream.setEncoding('utf8');
					stream.stderr.setEncoding('utf8');
					stream.on('data', (data: Buffer | string) => {
						if (settled) return;
						stdout += data.toString();
						onOutput?.(data.toString());
					});
					stream.stderr.on('data', (data: Buffer | string) => {
						if (settled) return;
						stderr += data.toString();
						onOutput?.(data.toString());
					});
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
		if (settled) disconnect();
	});
}
