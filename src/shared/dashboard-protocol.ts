import type { AssetViewEntry } from '@/features/assets/protocol';
import type { TempTreeEntry } from '@/features/temp/protocol';

export interface DashboardData {
  temp: TempTreeEntry[];
  assets: AssetViewEntry[];
}
