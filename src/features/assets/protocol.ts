import type { TempTreeEntry } from '@/features/temp/protocol';

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
