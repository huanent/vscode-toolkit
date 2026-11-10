import * as vscode from 'vscode';
import { readClipboardFiles } from '@/host/utils/clipboard-files';
import { pasteFiles } from './paste-files';

export function createFileClipboard(refresh: () => Promise<void>) {
  let clipboard: { text: string; sources: vscode.Uri[]; cut: boolean } | undefined;

  async function write(sources: vscode.Uri[], cut: boolean): Promise<void> {
    if (!sources.length) return;
    const roots = sources.filter(
      (source) => !sources.some((parent) => parent !== source && source.scheme === parent.scheme &&
        source.authority === parent.authority && source.path.startsWith(`${parent.path.replace(/\/$/, '')}/`)),
    );
    const text = roots.map((source) => source.toString()).join('\n');
    await vscode.env.clipboard.writeText(text);
    clipboard = { text, sources: roots, cut };
  }

  async function paste(destination: vscode.Uri): Promise<void> {
    const current = clipboard;
    const owned = current && current.text === await vscode.env.clipboard.readText();
    const sources = owned ? current.sources : await readClipboardFiles();
    try {
      await pasteFiles(destination, sources, owned ? current.cut : false, (source) => {
        if (owned && current.cut) current.sources = current.sources.filter((entry) => entry !== source);
      });
    } finally {
      if (owned && current.cut && clipboard === current) {
        if (await vscode.env.clipboard.readText() !== current.text) clipboard = undefined;
        else if (current.sources.length) await write(current.sources, true);
        else {
          clipboard = undefined;
          await vscode.env.clipboard.writeText('');
        }
      }
      await refresh();
    }
  }

  async function copyExplorer(cut: boolean, resource?: vscode.Uri, selection?: vscode.Uri[]): Promise<void> {
    if (resource) {
      await write(selection?.some((uri) => uri.toString() === resource.toString()) ? selection : [resource], cut);
      return;
    }
    // Keyboard commands receive no resource arguments; let Explorer serialize its selection.
    await vscode.commands.executeCommand('copyFilePath');
    const paths = (await vscode.env.clipboard.readText()).split(/\r?\n/).filter(Boolean);
    await write(paths.map((value) => vscode.Uri.file(value)), cut);
  }

  async function pasteExplorer(resource?: vscode.Uri): Promise<void> {
    if (!clipboard || clipboard.text !== await vscode.env.clipboard.readText()) {
      try {
        await vscode.commands.executeCommand('filesExplorer.paste');
      } finally {
        await refresh();
      }
      return;
    }
    if (!resource) {
      const text = await vscode.env.clipboard.readText();
      try {
        await vscode.commands.executeCommand('copyFilePath');
        const selectedPath = (await vscode.env.clipboard.readText()).split(/\r?\n/)[0];
        if (selectedPath && selectedPath !== text) resource = vscode.Uri.file(selectedPath);
      } finally {
        await vscode.env.clipboard.writeText(text);
      }
    }
    resource ??= vscode.workspace.workspaceFolders?.length === 1 ? vscode.workspace.workspaceFolders[0].uri : undefined;
    if (!resource) throw new Error('Select a destination folder in Explorer.');
    const stat = await vscode.workspace.fs.stat(resource);
    await paste(stat.type & vscode.FileType.Directory ? resource : vscode.Uri.joinPath(resource, '..'));
  }

  async function getCutUris(): Promise<string[]> {
    return clipboard?.cut && clipboard.text === await vscode.env.clipboard.readText()
      ? clipboard.sources.map((source) => source.toString())
      : [];
  }

  return { write, paste, copyExplorer, pasteExplorer, getCutUris };
}

export type FileClipboard = ReturnType<typeof createFileClipboard>;
