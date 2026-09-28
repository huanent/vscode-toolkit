import * as vscode from 'vscode';
import { registerWebviewEditor } from '@/host/webview-editor';
import type { ArchiveTreeEntry } from './protocol';
import { readArchiveTree, validateArchiveUri } from './service';

export const archiveEditorViewType = 'toolkit.archiveEditor';

export function registerArchiveEditor(context: vscode.ExtensionContext): vscode.Disposable {
  return registerWebviewEditor<ArchiveTreeEntry[]>(context, {
    viewType: archiveEditorViewType,
    page: 'archive',
    icon: 'file-zip',
    validate: validateArchiveUri,
    load: readArchiveTree,
  });
}
