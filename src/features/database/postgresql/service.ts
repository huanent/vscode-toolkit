import { randomUUID } from 'node:crypto';
import { Client, type QueryArrayConfig } from 'pg';
import type { DatabaseProvider } from '@/features/database/database-provider';
import type { AssetFormValues, AssetRequest, AssetViewEntry } from '@/features/assets/protocol';
import type { AssetRecord, AssetService } from '@/features/assets/service';
import type { CredentialService } from '@/features/credential/service';
import type { DatabaseQueryResult, PostgresqlConnectionConfiguration } from '@/features/database/protocol';

export class PostgresqlService implements DatabaseProvider {
  readonly type = 'postgresql';
  readonly label = 'PostgreSQL';
  readonly icon = 'database';
  readonly capabilities = { database: true, tls: true, query: true };
  private readonly connections = new Set<Client>();
  private disposed = false;

  constructor(
    private readonly assets: AssetService,
    private readonly credentials: CredentialService,
    private readonly openQuery: (asset: PostgresqlConnectionConfiguration) => Promise<void>,
  ) {}

  getFormValues(record?: AssetRecord): AssetFormValues {
    const previous = record ? requirePostgresqlConfiguration(record) : undefined;
    return {
      name: previous?.name ?? '',
      description: record?.description ?? '',
      host: previous?.host ?? 'localhost',
      port: previous?.port ?? 5432,
      database: previous?.database ?? '',
      credentialId: previous?.credentialId ?? '',
      tls: previous?.tls ?? false,
      enableAI: record?.enableAI !== false,
      storageScope: record?.scope ?? 'global',
    };
  }

  async saveConfiguration(values: AssetFormValues, record?: AssetRecord, folder?: string): Promise<void> {
    const previous = record ? requirePostgresqlConfiguration(record) : undefined;
    const asset = requirePostgresqlConfiguration({
      id: previous?.id ?? randomUUID(),
      type: this.type,
      name: values.name.trim(),
      host: values.host.trim(),
      port: values.port,
      credentialId: values.credentialId,
      database: values.database.trim() || undefined,
      tls: values.tls,
    });
    await this.assets.save({
      ...asset,
      description: values.description.trim() || undefined,
      enableAI: values.enableAI,
      folder: record?.folder ?? folder,
      scope: values.storageScope,
    });
  }

  toViewEntry(record: AssetRecord): AssetViewEntry {
    const asset = requirePostgresqlConfiguration(record);
    return {
      path: asset.id,
      name: asset.name,
      type: 'file',
      detail: asset.host,
      context: { assetId: asset.id, assetType: this.type },
    };
  }

  async execute(record: AssetRecord, request: AssetRequest): Promise<void> {
    if (request.action === 'connect' || request.action === 'query') {
      await this.openQuery(requirePostgresqlConfiguration(record));
    }
  }

  async requireAsset(id: string): Promise<PostgresqlConnectionConfiguration> {
    return requirePostgresqlConfiguration(await this.assets.get(id));
  }

  async requireAiAsset(id: string): Promise<PostgresqlConnectionConfiguration> {
    return requirePostgresqlConfiguration(await this.assets.requireAiAsset(id));
  }

  async executeAiQuery(
    id: string,
    database: string | undefined,
    sql: string,
    signal: AbortSignal,
  ): Promise<DatabaseQueryResult> {
    return this.query(await this.requireAiAsset(id), database, sql, signal);
  }

  async query(
    asset: PostgresqlConnectionConfiguration,
    database: string | undefined,
    sql: string,
    signal: AbortSignal,
  ): Promise<DatabaseQueryResult> {
    if (this.disposed || signal.aborted) throw new Error('PostgreSQL operation was cancelled.');
    const credential = (await this.credentials.list()).find((entry) => entry.id === asset.credentialId);
    if (!credential) throw new Error('Credential not found.');
    const client = new Client({
      host: asset.host,
      port: asset.port,
      user: credential.username,
      password: credential.password ?? '',
      database: database ?? asset.database ?? 'postgres',
      ssl: asset.tls ? { rejectUnauthorized: true } : false,
      connectionTimeoutMillis: 10000,
      statement_timeout: 60000,
    });
    const close = () => {
      void client.end().catch(() => undefined);
    };
    client.on('error', close);
    this.connections.add(client);
    signal.addEventListener('abort', close, { once: true });
    try {
      if (this.disposed || signal.aborted) throw new Error('PostgreSQL operation was cancelled.');
      await client.connect();
      if (this.disposed || signal.aborted) throw new Error('PostgreSQL operation was cancelled.');
      const config: QueryArrayConfig & { queryMode: string } = {
        text: sql,
        rowMode: 'array',
        queryMode: 'extended',
      };
      const result = await client.query(config);
      return {
        hasResultSet: result.fields.length > 0,
        columns: result.fields.map((field) => field.name),
        rows: result.rows
          .slice(0, 1000)
          .map((row: unknown[]) =>
            row.map((value) =>
              value == null
                ? null
                : typeof value === 'number' || typeof value === 'string'
                  ? value
                  : Buffer.isBuffer(value)
                    ? value.toString('hex')
                    : value instanceof Date
                      ? value.toISOString()
                      : JSON.stringify(value),
            ),
          ),
        rowCount: result.fields.length ? (result.rowCount ?? result.rows.length) : 0,
        truncated: result.rows.length > 1000,
        changes: result.fields.length ? 0 : (result.rowCount ?? 0),
      };
    } finally {
      signal.removeEventListener('abort', close);
      this.connections.delete(client);
      await client.end().catch(() => undefined);
    }
  }

  invalidate(id?: string): void {
    void id;
  }

  dispose(): void {
    this.disposed = true;
    for (const client of this.connections) void client.end().catch(() => undefined);
    this.connections.clear();
  }
}

function requirePostgresqlConfiguration(value: unknown): PostgresqlConnectionConfiguration {
  if (!value || typeof value !== 'object') throw new Error('Invalid PostgreSQL configuration.');
  const asset = value as Partial<PostgresqlConnectionConfiguration>;
  if (
    asset.type !== 'postgresql' ||
    typeof asset.id !== 'string' ||
    !/^[a-zA-Z0-9-]+$/.test(asset.id) ||
    typeof asset.name !== 'string' ||
    !asset.name.trim() ||
    typeof asset.host !== 'string' ||
    !asset.host.trim() ||
    typeof asset.credentialId !== 'string' ||
    !asset.credentialId ||
    typeof asset.port !== 'number' ||
    !Number.isInteger(asset.port) ||
    asset.port < 1 ||
    asset.port > 65535 ||
    typeof asset.tls !== 'boolean' ||
    (asset.database !== undefined && typeof asset.database !== 'string')
  )
    throw new Error('Invalid PostgreSQL configuration. Name, host, port and credential are required.');
  return asset as PostgresqlConnectionConfiguration;
}
