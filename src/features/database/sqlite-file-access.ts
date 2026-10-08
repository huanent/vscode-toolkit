import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';

export async function withSqliteFile<TResult>(
  uri: vscode.Uri,
  mode: 'read' | 'write',
  operation: (databasePath: string) => TResult,
): Promise<TResult> {
  if (uri.scheme === 'file') {
    if (mode === 'write') {
      const file = await stat(uri.fsPath);
      if (!file.isFile()) throw new Error('The SQLite database URI must point to a file.');
    }
    return operation(uri.fsPath);
  }

  const originalData = await vscode.workspace.fs.readFile(uri);
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'toolkit-sqlite-'));
  const temporaryPath = path.join(temporaryDirectory, path.posix.basename(uri.path) || 'database.sqlite');
  try {
    await writeFile(temporaryPath, originalData);
    const result = operation(temporaryPath);
    if (mode === 'write') {
      const updatedData = await readFile(temporaryPath);
      if (!Buffer.from(originalData).equals(updatedData)) {
        await vscode.workspace.fs.writeFile(uri, updatedData);
      }
    }
    return result;
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}
