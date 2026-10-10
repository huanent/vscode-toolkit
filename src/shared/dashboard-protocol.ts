import type { AssetViewEntry } from '@/features/assets/protocol';
import type { TempTreeEntry } from '@/features/temp/protocol';
import type { WorkflowRecordEntry } from '@/features/workflow/protocol';

export interface DashboardData {
  temp: TempTreeEntry[];
  workflow: WorkflowRecordEntry[];
  assets: AssetViewEntry[];
}
