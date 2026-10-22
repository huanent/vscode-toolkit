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
