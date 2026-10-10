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
  type: 'file' | 'directory';
  detail?: string;
  context: Record<string, string | number | boolean>;
  children?: AssetViewEntry[];
}

export type AssetsMessage =
  | { type: 'assetsUpdated'; entries: AssetViewEntry[] }
  | { type: 'assetError'; message: string };

export interface AssetRequest {
  type: 'assetAction';
  action: 'add' | 'createFolder' | 'edit' | 'delete' | 'connect' | 'query' | 'preview';
  folderId?: string;
  id?: string;
  database?: string;
  table?: string;
  assetType?: string;
}
