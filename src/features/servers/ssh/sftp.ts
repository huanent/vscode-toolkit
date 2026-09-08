import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { SFTPWrapper } from 'ssh2';
import { SshServer } from '../servers/server';
import { ServerCredentials } from '../servers/serverStore';
import { connectSshClient } from './sshConnection';

export interface SftpEntry {
	name: string;
	path: string;
	isDirectory: boolean;
	size: number;
	modifiedAt: string;
}

export async function listSftpDirectory(
	server: SshServer,
	credentials: ServerCredentials,
	remoteDirectory: string,
): Promise<SftpEntry[]> {
	return withSftp(
		server,
		credentials,
		sftp =>
			new Promise((resolve, reject) => {
				sftp.readdir(remoteDirectory, (error, entries) => {
					if (error) {
						reject(error);
						return;
					}
					resolve(
						entries
							.filter(entry => entry.filename !== '.' && entry.filename !== '..')
							.map(entry => ({
								name: entry.filename,
								path: path.posix.join(remoteDirectory, entry.filename),
								isDirectory: entry.attrs.isDirectory(),
								size: entry.attrs.size,
								modifiedAt: new Date(entry.attrs.mtime * 1000).toISOString(),
							}))
							.sort(
								(left, right) =>
									Number(right.isDirectory) - Number(left.isDirectory) ||
									left.name.localeCompare(right.name),
							),
					);
				});
			}),
	);
}

export async function readSftpFile(
	server: SshServer,
	credentials: ServerCredentials,
	remotePath: string,
): Promise<string> {
	return withSftp(server, credentials, async sftp => {
		const contents = await new Promise<Buffer>((resolve, reject) => {
			sftp.readFile(remotePath, (error, data) => (error ? reject(error) : resolve(data)));
		});
		return contents.toString('utf8');
	});
}

export async function writeSftpFile(
	server: SshServer,
	credentials: ServerCredentials,
	localPath: string,
	remotePath: string,
): Promise<void> {
	await withSftp(
		server,
		credentials,
		sftp =>
			new Promise<void>((resolve, reject) => {
				sftp.fastPut(localPath, remotePath, error => (error ? reject(error) : resolve()));
			}),
	);
}

export async function downloadSftpFile(
	server: SshServer,
	credentials: ServerCredentials,
	remotePath: string,
	localPath: string,
): Promise<void> {
	await fs.mkdir(path.dirname(localPath), { recursive: true });
	await withSftp(
		server,
		credentials,
		sftp =>
			new Promise<void>((resolve, reject) => {
				sftp.fastGet(remotePath, localPath, error => (error ? reject(error) : resolve()));
			}),
	);
}

export async function deleteSftpEntry(
	server: SshServer,
	credentials: ServerCredentials,
	remotePath: string,
	isDirectory: boolean,
): Promise<void> {
	await withSftp(
		server,
		credentials,
		sftp =>
			new Promise<void>((resolve, reject) => {
				const callback = (error?: Error | null) => (error ? reject(error) : resolve());
				if (isDirectory) {
					sftp.rmdir(remotePath, callback);
				} else {
					sftp.unlink(remotePath, callback);
				}
			}),
	);
}

export async function createSftpDirectory(
	server: SshServer,
	credentials: ServerCredentials,
	remotePath: string,
): Promise<void> {
	await withSftp(
		server,
		credentials,
		sftp =>
			new Promise<void>((resolve, reject) => {
				sftp.mkdir(remotePath, error => (error ? reject(error) : resolve()));
			}),
	);
}

export async function renameSftpEntry(
	server: SshServer,
	credentials: ServerCredentials,
	fromPath: string,
	toPath: string,
): Promise<void> {
	await withSftp(
		server,
		credentials,
		sftp =>
			new Promise<void>((resolve, reject) => {
				sftp.rename(fromPath, toPath, error => (error ? reject(error) : resolve()));
			}),
	);
}

async function withSftp<T>(
	server: SshServer,
	credentials: ServerCredentials,
	operation: (sftp: SFTPWrapper) => Promise<T>,
): Promise<T> {
	return new Promise((resolve, reject) => {
		let settled = false;
		const finish = (error?: Error, value?: T) => {
			if (settled) return;
			settled = true;
			connection?.dispose();
			if (error) reject(error);
			else resolve(value as T);
		};
		let connection: { dispose: () => void } | undefined;
		connectSshClient(
			server,
			credentials,
			nextConnection => {
				connection = nextConnection;
				nextConnection.client.sftp((error, sftp) => {
					if (error) {
						finish(error);
						return;
					}
					void operation(sftp).then(value => finish(undefined, value), finish);
				});
			},
			finish,
		);
	});
}
