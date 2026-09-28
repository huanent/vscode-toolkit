export interface TempTreeEntry {
  name: string;
  type: 'file' | 'directory';
  children?: TempTreeEntry[];
}

export interface CreateTempFileRequest {
  type: 'createTempFile';
}

export interface SetTempTabActiveRequest {
  type: 'setTempTabActive';
  active: boolean;
}

export interface OpenTempFileRequest {
  type: 'openTempFile';
  path: string;
}

export type TempFilesWebviewMessage =
  | { type: 'tempFilesUpdated'; entries: TempTreeEntry[] }
  | { type: 'tempFileError'; message: string };
