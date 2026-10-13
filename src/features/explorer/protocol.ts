export interface ExplorerEntry {
  /** Unique tree key: the workspace folder index followed by the relative path segments. */
  id: string;
  name: string;
  type: 'file' | 'directory';
  uri: string;
  children?: ExplorerEntry[];
}

export type ExplorerWebviewMessage = { type: 'openFile'; uri: string };
