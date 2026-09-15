import * as vscode from 'vscode';
import { ServerType } from './server';

export const editorViewType = 'vscode-toolkit.container.editor';

export type EditorKind = 'serverForm' | 'containerEditor';

export interface EditorDescriptor {
	kind: EditorKind;
	serverId?: string;
	serverType?: ServerType;
	duplicate?: boolean;
	database?: string;
	table?: string;
}

export function createEditorUri(descriptor: EditorDescriptor): vscode.Uri {
	const params = new URLSearchParams({ kind: descriptor.kind, id: crypto.randomUUID() });
	if (descriptor.serverId) params.set('serverId', descriptor.serverId);
	if (descriptor.serverType) params.set('serverType', descriptor.serverType);
	if (descriptor.duplicate) params.set('duplicate', 'true');
	if (descriptor.database) params.set('database', descriptor.database);
	if (descriptor.table) params.set('table', descriptor.table);

	return vscode.Uri.from({
		scheme: 'container',
		path: `/${descriptor.kind}.container`,
		query: params.toString(),
	});
}

export function parseEditorDescriptor(uri: vscode.Uri): EditorDescriptor {
	const params = new URLSearchParams(uri.query);
	const kind = params.get('kind');
	if (!isEditorKind(kind)) {
		throw new Error('The Servers editor resource has an unknown type.');
	}

	const serverType = params.get('serverType');
	return {
		kind,
		serverId: params.get('serverId') ?? undefined,
		serverType: serverType === 'container' ? serverType : undefined,
		duplicate: params.get('duplicate') === 'true',
		database: params.get('database') ?? undefined,
		table: params.get('table') ?? undefined,
	};
}

function isEditorKind(value: string | null): value is EditorKind {
	return value === 'serverForm' || value === 'containerEditor';
}
