export interface AssetFormValues {
  name: string;
  host: string;
  port: number;
  database: string;
  tls: boolean;
  credentialId: string;
}

export interface AssetEditorData {
  assetType: string;
  label: string;
  editing: boolean;
  values: AssetFormValues;
  credentials: { id: string; name: string }[];
}

export type AssetEditorMessage = { type: 'saveError'; message: string } | { type: 'privateKeySelected'; path: string };

export interface AssetViewEntry {
  path: string;
  name: string;
  type: 'file';
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
  action: 'add' | 'edit' | 'delete' | 'connect' | 'query' | 'preview';
  id?: string;
  database?: string;
  table?: string;
  assetType?: string;
}
