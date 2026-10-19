import type { Credential, CredentialSummary } from '@/features/credential/protocol';
import type { StorageScope } from '@/shared/storage-scope';
import type { HttpClientSettings } from '@/features/http/protocol';

export interface AssetSummary {
  id: string;
  type: string;
  name: string;
  folder?: string;
  host?: string;
  port?: number;
}

export interface AssetFormValues {
  name: string;
  description: string;
  host: string;
  port: number;
  database: string;
  tls: boolean;
  enableAI: boolean;
  storageScope: StorageScope;
  credentialId: string;
  proxyAssetIds?: string[];
  httpClient?: HttpClientSettings;
}

export interface AssetCapabilities {
  database?: boolean;
  tls?: boolean;
  proxyTunnel?: boolean;
  query?: boolean;
  httpClient?: boolean;
}

export interface AssetEditorData {
  assetType: string;
  icon: string;
  capabilities: AssetCapabilities;
  label: string;
  editing: boolean;
  workspaceStorageAvailable: boolean;
  values: AssetFormValues;
  credentials: CredentialSummary[];
  assets: AssetSummary[];
}

export type AssetEditorMessage =
  | { type: 'saveError'; message: string }
  | { type: 'privateKeySelected'; path: string }
  | { type: 'credentialsUpdated'; credentials: CredentialSummary[]; createdId: string }
  | { type: 'credentialError'; message: string };

export type AssetEditorRequest =
  | { type: 'save'; values: AssetFormValues }
  | { type: 'cancel' }
  | { type: 'createCredential'; credential: Credential };

export interface AssetViewEntry {
  path: string;
  name: string;
  type: 'file';
  icon?: string;
  detail?: string;
  context: Record<string, string | number | boolean>;
}

export interface AssetDirectoryEntry {
  path: string;
  name: string;
  type: 'directory';
  children: AssetTreeEntry[];
  context?: Record<string, string | number | boolean>;
}

export type AssetTreeEntry = AssetViewEntry | AssetDirectoryEntry;

export type AssetsMessage =
  | { type: 'assetsUpdated'; entries: AssetTreeEntry[] }
  | { type: 'assetError'; message: string };

export interface AssetRequest {
  type: 'assetAction';
  action: 'add' | 'edit' | 'delete' | 'duplicate' | 'connect' | 'query' | 'preview' | 'sftp';
  id?: string;
  database?: string;
  table?: string;
  assetType?: string;
  folder?: string;
}
