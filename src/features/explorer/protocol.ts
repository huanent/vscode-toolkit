export interface ExplorerEntry {
  /** Unique tree key: the workspace folder index followed by the relative path segments. */
  id: string;
  name: string;
  type: 'file' | 'directory';
  uri: string;
  children?: ExplorerEntry[];
  /** Size in bytes; files only. */
  size?: number;
  /** Creation time in milliseconds since the epoch. */
  createdAt?: number;
  /** Modification time in milliseconds since the epoch. */
  modifiedAt?: number;
}

export type ExplorerWebviewMessage = { type: 'openFile'; uri: string };
