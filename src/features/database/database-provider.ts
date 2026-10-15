import type { AssetProvider } from '@/features/assets/asset-provider';
import type { DatabaseQueryResult } from '@/features/database/protocol';

export interface DatabaseProvider extends AssetProvider {
  executeAiQuery(
    id: string,
    database: string | undefined,
    sql: string,
    signal: AbortSignal,
  ): Promise<DatabaseQueryResult>;
}
