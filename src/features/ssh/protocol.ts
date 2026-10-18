export interface SshConnectionConfiguration {
  id: string;
  type: 'ssh';
  name: string;
  host: string;
  port: number;
  credentialId: string;
  proxyAssetIds?: string[];
  sftpFavorites?: string[];
}

export type SftpSide = 'local' | 'remote';

export interface SftpEntry {
  path: string;
  name: string;
  type: 'file' | 'directory';
  size?: number;
  mode?: number;
  modifiedAt: number;
  symbolicLink: boolean;
}

export interface SftpDirectory {
  path: string;
  parent: string;
  entries: SftpEntry[];
  canGoBack?: boolean;
}

export interface SftpEditorData {
  name: string;
  local: SftpDirectory;
  remote?: SftpDirectory;
  busy: Record<SftpSide, boolean>;
  favorites: Record<SftpSide, string[]>;
  error?: string;
}

export type SftpRequest =
  | { type: 'toggleFavorite'; side: SftpSide; address: string }
  | { type: 'navigate'; side: SftpSide; path: string }
  | { type: 'refresh' }
  | { type: 'back'; side: SftpSide }
  | { type: 'create'; side: SftpSide; directory: boolean }
  | { type: 'rename' | 'delete' | 'open' | 'transfer'; side: SftpSide; path: string };
