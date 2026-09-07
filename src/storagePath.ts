import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';

export function getStorageUri(context: vscode.ExtensionContext, directory: string): vscode.Uri {
	const configuredPath = vscode.workspace
		.getConfiguration('toolkit')
		.get<string>('storagePath', '')
		.trim();
	const rootUri = configuredPath
		? vscode.Uri.file(resolveStoragePath(configuredPath))
		: context.globalStorageUri;
	return vscode.Uri.joinPath(rootUri, directory);
}

function resolveStoragePath(configuredPath: string): string {
	const expandedPath =
		configuredPath === '~'
			? os.homedir()
			: configuredPath.startsWith(`~${path.sep}`)
				? path.join(os.homedir(), configuredPath.slice(2))
				: configuredPath;
	if (!path.isAbsolute(expandedPath)) {
		throw new Error('Toolkit storage path must be an absolute path.');
	}
	return expandedPath;
}
