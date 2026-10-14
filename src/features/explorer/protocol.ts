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
  canGoBack: boolean;
  hasWorkspace: boolean;
  favorites?: string[];
}

export type ExplorerWebviewMessage =
  | { type: 'openFile'; uri: string }
  | { type: 'readDirectory'; uri: string | null }
  | { type: 'navigateAddress'; address: string }
  | { type: 'setViewMode'; mode: 'list' | 'grid' }
  | { type: 'toggleFavorite'; address: string }
  | { type: 'goBack' };
