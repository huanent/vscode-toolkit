import type { DatabaseCellValue, DatabaseQueryInput, DatabaseQueryResult } from '@/features/database/protocol';
import type { ResultTask } from '@/features/result/protocol';
import { Empty } from '@/webview/components/empty';
import { Icon } from '@/webview/components/icons';
import { Loading } from '@/webview/components/loading';

export function SqliteQueryResultView({ task }: { task: ResultTask }) {
  const input = isDatabaseQueryInput(task.input) ? task.input : undefined;

  if (task.status === 'running') {
    return <Loading label={input ? `Running query on ${input.databaseName}...` : 'Running SQLite query...'} />;
  }

  if (task.status !== 'completed') {
    const title =
      task.status === 'cancelled'
        ? 'Query cancelled'
        : task.status === 'interrupted'
          ? 'Query interrupted'
          : 'Query failed';
    return (
      <Empty
        label="SQLite query failed"
        title={title}
        description={task.error ?? 'The query did not complete.'}
        icon="warning"
      />
    );
  }

  if (!input || !isDatabaseQueryResult(task.output)) {
    return (
      <Empty
        label="SQLite result unavailable"
        title="Could not display this SQLite query"
        description="The saved query input or result is missing or invalid."
        icon="warning"
      />
    );
  }

  const result = task.output;
  const elapsed = Math.max(0, task.updatedAt - task.createdAt);

  return (
    <div className="flex flex-col gap-3">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-(--vscode-panel-border) pb-3">
        <div className="flex min-w-0 items-center gap-2">
          <Icon name="database" variant="muted" size="sm" />
          <span className="min-w-0 truncate text-sm font-semibold" title={input.databaseName}>
            {input.databaseName}
          </span>
        </div>
        <span className="shrink-0 text-xs tabular-nums text-(--vscode-descriptionForeground)">
          {result.hasResultSet ? `${result.rowCount} rows` : `${result.changes} rows affected`} · {elapsed} ms
        </span>
      </header>

      <section>
        <h3 className="mb-1 text-xs font-semibold text-(--vscode-descriptionForeground)">SQL</h3>
        <pre className="max-h-50 overflow-auto border border-(--vscode-panel-border) bg-(--vscode-editor-background) p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all">
          {input.sql}
        </pre>
      </section>

      {result.hasResultSet && result.columns.length ? (
        <section aria-label="SQLite query results" className="overflow-auto border border-(--vscode-panel-border)">
          <table className="w-max min-w-full border-separate border-spacing-0 text-xs">
            <thead className="sticky top-0 z-10">
              <tr>
                {result.columns.map((column, index) => (
                  <th
                    key={`${index}:${column}`}
                    className="h-9 min-w-36 border-r border-b border-(--vscode-panel-border) bg-(--vscode-sideBar-background) px-2 text-left font-medium"
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {result.columns.map((column, columnIndex) => (
                    <td
                      key={`${columnIndex}:${column}`}
                      className="h-7 max-w-80 overflow-hidden border-r border-b border-(--vscode-panel-border) px-2 font-mono text-ellipsis whitespace-nowrap"
                      title={formatCell(row[columnIndex] ?? null)}
                    >
                      {formatCell(row[columnIndex] ?? null)}
                    </td>
                  ))}
                </tr>
              ))}
              {!result.rows.length && (
                <tr>
                  <td
                    colSpan={result.columns.length}
                    className="h-14 text-center text-(--vscode-descriptionForeground)"
                  >
                    No rows returned.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      ) : result.hasResultSet ? (
        <div className="border border-(--vscode-panel-border) p-3 text-sm text-(--vscode-descriptionForeground)">
          No rows returned.
        </div>
      ) : (
        <div className="border border-(--vscode-panel-border) p-3 text-sm">
          <span>{result.changes} row(s) affected.</span>
          {result.lastInsertRowId !== undefined && (
            <span className="ml-3 text-xs text-(--vscode-descriptionForeground)">
              Last inserted row ID: {result.lastInsertRowId}
            </span>
          )}
        </div>
      )}

      {result.truncated && (
        <p className="text-xs text-(--vscode-descriptionForeground)">
          Showing {result.rows.length} of {result.rowCount} rows.
        </p>
      )}
    </div>
  );
}

function isDatabaseQueryInput(value: unknown): value is DatabaseQueryInput {
  if (typeof value !== 'object' || value === null) return false;
  const input = value as Partial<DatabaseQueryInput>;
  return typeof input.databaseName === 'string' && typeof input.sql === 'string';
}

function isDatabaseQueryResult(value: unknown): value is DatabaseQueryResult {
  if (typeof value !== 'object' || value === null) return false;
  const result = value as Partial<DatabaseQueryResult>;
  return (
    typeof result.hasResultSet === 'boolean' &&
    Array.isArray(result.columns) &&
    result.columns.every((column) => typeof column === 'string') &&
    Array.isArray(result.rows) &&
    result.rows.every((row) => Array.isArray(row) && row.every(isDatabaseCellValue)) &&
    typeof result.rowCount === 'number' &&
    typeof result.truncated === 'boolean' &&
    (typeof result.changes === 'number' || typeof result.changes === 'string') &&
    (result.lastInsertRowId === undefined ||
      typeof result.lastInsertRowId === 'number' ||
      typeof result.lastInsertRowId === 'string')
  );
}

function isDatabaseCellValue(value: unknown): value is DatabaseCellValue {
  return value === null || typeof value === 'string' || typeof value === 'number';
}

function formatCell(value: DatabaseCellValue): string {
  return value === null ? 'NULL' : String(value);
}
