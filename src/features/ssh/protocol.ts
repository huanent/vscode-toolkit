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

export interface SftpResources {
  cpu?: number;
  memory?: number;
  disk?: number;
  networkIn?: number;
  networkOut?: number;
}

export interface SftpEditorData {
  name: string;
  local: SftpDirectory;
  remote?: SftpDirectory;
  resources?: Partial<Record<SftpSide, SftpResources>>;
  busy: Record<SftpSide, boolean>;
  favorites: Record<SftpSide, string[]>;
  error?: string;
}

export type SftpRequest =
  | { type: 'toggleFavorite'; side: SftpSide; address: string }
  | { type: 'navigate'; side: SftpSide; path: string }
  | { type: 'refresh' }
  | { type: 'back'; side: SftpSide }
  | { type: 'create'; side: SftpSide; directory: boolean; path: string }
  | { type: 'rename' | 'delete' | 'open' | 'transfer'; side: SftpSide; path: string };
