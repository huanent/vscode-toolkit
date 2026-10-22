export interface ExplorerEntry {
  /** Directory or file URI. */
  id: string;
  name: string;
  type: 'file' | 'directory';
  uri: string;
  /** Size in bytes; files only. */
  size?: number;
  /** Creation time in milliseconds since the epoch. */
  createdAt?: number;
  /** Modification time in milliseconds since the epoch. */
  modifiedAt?: number;
}

export interface ExplorerDirectory {
  location: string | null;
  ancestors: ExplorerEntry[];
  entries: ExplorerEntry[];
  cutUris?: string[];
  canGoBack: boolean;
  hasWorkspace: boolean;
  favorites?: string[];
}

export type ExplorerWebviewMessage =
  | { type: 'openFile'; uri: string }
  | { type: 'copyEntries'; uris: string[] }
  | { type: 'cutEntries'; uris: string[] }
  | { type: 'deleteEntries'; uris: string[] }
  | { type: 'pasteEntries' }
  | { type: 'refresh' }
  | { type: 'readDirectory'; uri: string | null }
  | { type: 'navigateAddress'; address: string }
  | { type: 'setViewMode'; mode: 'list' | 'grid' }
  | { type: 'toggleFavorite'; address: string }
  | { type: 'goBack' };
