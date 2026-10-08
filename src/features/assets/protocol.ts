import type { TempTreeEntry } from '@/features/temp/protocol';

export interface AssetFormValues {
  name: string;
  host: string;
  port: number;
  user: string;
  database: string;
  tls: boolean;
  privateKeyPath: string;
  password: string;
}

export interface AssetEditorData {
  assetType: string;
  label: string;
  editing: boolean;
  values: AssetFormValues;
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

export interface DashboardData {
  temp: TempTreeEntry[];
  assets: AssetViewEntry[];
}

export type AssetsMessage =
  | { type: 'assetsUpdated'; entries: AssetViewEntry[] }
  | { type: 'assetError'; message: string };

export interface AssetRequest {
  type: 'assetAction';
  action: 'add' | 'edit' | 'delete' | 'connect' | 'disconnect' | 'query' | 'preview';
  id?: string;
  database?: string;
  table?: string;
  assetType?: string;
}
