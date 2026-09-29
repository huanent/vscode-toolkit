export type TempEntryType = 'file' | 'directory';

export interface TempTreeEntry {
  name: string;
  type: TempEntryType;
  children?: TempTreeEntry[];
}

/**
 * `data-vscode-context` payload of a right-clicked temp entry. It is also the
 * argument passed to the temp `webview/context` menu commands.
 */
export interface TempContextTarget {
  /** Slash-separated path relative to the temp directory. */
  tempEntryPath?: string;
  tempEntryType?: TempEntryType;
}

export interface OpenTempFileRequest {
  type: 'openTempFile';
  path: string;
}

export type TempFilesWebviewMessage =
  | { type: 'tempFilesUpdated'; entries: TempTreeEntry[] }
  | { type: 'tempFileError'; message: string };
