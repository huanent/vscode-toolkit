import type { AssetTreeEntry } from '@/features/assets/protocol';
import type { TempScopeGroup } from '@/features/temp/protocol';
import type { PlaybookRecordEntry } from '@/features/playbook/protocol';

export interface DashboardData {
  temp: TempScopeGroup[];
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

export interface DashboardSearchResult {
  type: 'dashboardSearchResult';
  requestId: number;
  matches: string[];
}
