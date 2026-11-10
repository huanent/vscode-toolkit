import * as path from 'node:path';
import * as vscode from 'vscode';

export async function pasteFiles(
  destination: vscode.Uri,
  sources: readonly vscode.Uri[],
  cut: boolean,
  onMoved: (source: vscode.Uri) => void,
): Promise<void> {
  if (!sources.length) throw new Error('No files or folders found on the clipboard.');
  await vscode.workspace.fs.createDirectory(destination);
  for (const source of sources) {
    const stats = await vscode.workspace.fs.stat(source);
    const sameProvider = source.scheme === destination.scheme && source.authority === destination.authority;
    if (sameProvider && (stats.type & vscode.FileType.Directory)) {
      const relative = path.posix.relative(source.path, destination.path);
      if (!relative || (relative !== '..' && !relative.startsWith('../') && !path.posix.isAbsolute(relative))) {
        throw new Error('Cannot paste a folder into itself.');
      }
    }
    if (cut && sameProvider && path.posix.dirname(source.path) === destination.path.replace(/\/$/, '')) {
      onMoved(source);
      continue;
    }
    const name = path.posix.basename(source.path);
    if (!name) throw new Error('Cannot paste a file system root.');
    const extension = stats.type & vscode.FileType.Directory ? '' : path.extname(name);
    const stem = name.slice(0, name.length - extension.length);
    let index = 0;
    while (true) {
      const target = vscode.Uri.joinPath(
        destination,
        index ? `${stem} copy${index > 1 ? ` ${index}` : ''}${extension}` : name,
      );
      try {
        if (cut) {
          try {
            await vscode.workspace.fs.stat(target);
            index++;
            continue;
          } catch (error) {
            if (!(error instanceof vscode.FileSystemError) || error.code !== 'FileNotFound') throw error;
          }
          const edit = new vscode.WorkspaceEdit();
          edit.renameFile(source, target, { overwrite: false });
          if (!await vscode.workspace.applyEdit(edit)) throw new Error(`Could not move "${name}".`);
          onMoved(source);
        } else {
          await vscode.workspace.fs.copy(source, target, { overwrite: false });
        }
        break;
      } catch (error) {
        if (!(error instanceof vscode.FileSystemError) || error.code !== 'FileExists') throw error;
        index++;
      }
    }
  }
}
