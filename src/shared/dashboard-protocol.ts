import type { AssetTreeEntry } from '@/features/assets/protocol';
import type { TempTreeEntry } from '@/features/temp/protocol';
import type { PlaybookRecordEntry } from '@/features/playbook/protocol';

export interface DashboardData {
  temp: TempTreeEntry[];
  playbook: PlaybookRecordEntry[];
  assets: AssetTreeEntry[];
}

export interface CollapseDashboardTreeMessage {
  type: 'collapseActiveTree';
}

export interface SearchDashboardTreeMessage {
  type: 'searchActiveTree';
}

export interface DashboardSearchRequest {
  type: 'searchDashboardContents';
  tab: 'assets' | 'playbook' | 'temp';
  query: string;
  requestId: number;
}

export type DashboardSearchResult =
  | { type: 'dashboardSearchResult'; requestId: number; matches: string[] }
  | { type: 'dashboardSearchError'; requestId: number; message: string };
