import * as path from 'node:path';
import * as vscode from 'vscode';

const nodeExtensions = new Set(['.js', '.mjs', '.cjs', '.ts', '.mts', '.cts']);

export async function resolveNodeDocument(
	uri: vscode.Uri | undefined,
): Promise<vscode.TextDocument | undefined> {
	if (uri && isNodeScriptUri(uri)) {
		return vscode.workspace.openTextDocument(uri);
	}

	const activeDocument = vscode.window.activeTextEditor?.document;
	return activeDocument && isNodeScriptDocument(activeDocument) ? activeDocument : undefined;
}

export async function getRunnableFileUri(
	context: vscode.ExtensionContext,
	document: vscode.TextDocument,
): Promise<vscode.Uri> {
	if (document.uri.scheme !== 'untitled') {
		if (document.isDirty) {
			await document.save();
		}
		return document.uri;
	}

	const extension = document.languageId === 'typescript' ? '.ts' : '.js';
	const tempDirectory = vscode.Uri.joinPath(context.globalStorageUri, 'scripts');
	const tempUri = vscode.Uri.joinPath(tempDirectory, `untitled${extension}`);
	await vscode.workspace.fs.createDirectory(tempDirectory);
	await vscode.workspace.fs.writeFile(tempUri, Buffer.from(document.getText()));
	return tempUri;
}

export function isTypeScriptDocument(document: vscode.TextDocument): boolean {
	return (
		document.languageId === 'typescript' ||
		['.ts', '.mts', '.cts'].includes(path.extname(document.uri.fsPath).toLowerCase())
	);
}

export function isNodeScriptUri(uri: vscode.Uri): boolean {
	const isFileSystemUri = uri.scheme === 'file' || uri.scheme === 'vscode-remote';
	return (
		uri.scheme === 'untitled' ||
		(isFileSystemUri && nodeExtensions.has(path.extname(uri.fsPath).toLowerCase()))
	);
}

function isNodeScriptDocument(document: vscode.TextDocument): boolean {
	return (
		document.languageId === 'javascript' ||
		document.languageId === 'typescript' ||
		isNodeScriptUri(document.uri)
	);
}
