import type { StorageScope } from '@/shared/storage-scope';

export const TEMP_FILE_SYSTEM_SCHEME = 'toolkit-temp';

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
export interface TempScopeGroup {
  scope: StorageScope;
  entries: TempTreeEntry[];
}

export interface TempContextTarget {
  tempScope?: StorageScope;
  /** Slash-separated path relative to the temp directory. */
  tempEntryPath?: string;
  tempEntryType?: TempEntryType;
}

export interface OpenTempFileRequest {
  type: 'openTempFile';
  path: string;
  scope?: StorageScope;
}

export interface TempFileCommandRequest extends TempContextTarget {
  type: 'tempFileCommand';
  command: 'copy' | 'cut' | 'paste' | 'delete' | 'rename' | 'copyPath';
}

export interface CreateTempEntryRequest extends TempContextTarget {
  type: 'createTempEntry';
  requestId: string;
  entryType: TempEntryType;
  name: string;
}

export type TempFilesWebviewMessage =
  | { type: 'beginTempEntry'; entryType: TempEntryType; target: TempContextTarget }
  | { type: 'tempEntryCreated'; requestId: string; error?: string }
  | { type: 'tempFilesUpdated'; entries: TempScopeGroup[] }
  | { type: 'tempFileError'; message: string };
