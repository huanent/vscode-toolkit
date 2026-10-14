import * as vscode from 'vscode';

export interface FolderPickerChoice extends vscode.QuickPickItem {
  folderPath?: string;
}

export function showFolderPicker(folderPaths: readonly string[]): Thenable<FolderPickerChoice | undefined> {
  return vscode.window.showQuickPick(
    [{ label: 'Root', folderPath: undefined }, ...folderPaths.map((folderPath) => ({ label: folderPath, folderPath }))],
    { title: 'Move to Folder', placeHolder: 'Select a destination folder' },
  );
}
