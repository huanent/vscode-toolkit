import { databaseTablePageSize } from '@/features/database/protocol';
import { mountWebview } from '@/webview/bootstrap';
import { Button } from '@/webview/components/button';
import { Empty } from '@/webview/components/empty';
import { ErrorMessage } from '@/webview/components/error-message';
import { Icon } from '@/webview/components/icons';
import { Input } from '@/webview/components/input';
import { Loading } from '@/webview/components/loading';
import { postToHost } from '@/webview/utils/host-data';
import { DataTable } from '@/webview/pages/database/data/data-table';
import { RowEditor } from '@/webview/pages/database/data/row-editor';
import { useTableData } from '@/webview/pages/database/data/use-table-data';
import '@/webview/styles.css';

function App() {
  const data = useTableData();
  const { state, search, columnFilters, hasActiveFilters, clearFilters, setSearch, setPage, pending, mutationPending } =
    data;

  if (state.status !== 'loaded') {
    return (
      <main className="grid min-h-dvh place-items-center bg-(--vscode-editor-background) p-4 text-(--vscode-foreground)">
        {state.status === 'loading' ? (
          <Loading label="Reading table..." />
        ) : (
          <div className="flex w-full max-w-lg flex-col items-center gap-3">
            <ErrorMessage message={state.message} className="w-full" />
            <Button variant="secondary" prefix={<Icon name="refresh" />} onClick={() => postToHost({ type: 'ready' })}>
              Retry
            </Button>
          </div>
        )}
      </main>
    );
  }

  const table = state.data;
  const displayedPage = table.displayedPage ?? 0;
  const totalRows = table.filteredRowCount ?? table.rowCount;
  const pageCount = Math.max(1, Math.ceil(totalRows / databaseTablePageSize));
  const firstRow = displayedPage * databaseTablePageSize + 1;
  const lastRow = displayedPage * databaseTablePageSize + table.rows.length;
  const busy = pending || mutationPending;
  const error = data.mutationError ?? state.error;

  return (
    <main className="flex h-dvh min-w-0 select-text flex-col overflow-hidden bg-(--vscode-editor-background) text-(--vscode-foreground)">
      <div
        role="toolbar"
        aria-label="Table data tools"
        className="flex shrink-0 flex-wrap items-center gap-2 border-b border-(--vscode-panel-border) p-2"
      >
        <div className="min-w-32 flex-1 sm:max-w-80">
          <Input
            type="search"
            prefix={<Icon name="search" size="sm" variant="muted" />}
            aria-label="Search rows"
            placeholder="Search rows..."
            value={search}
            disabled={mutationPending}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(0);
            }}
          />
        </div>
        <Button
          variant="ghost"
          prefix={<Icon name="add" />}
          aria-label="Create row"
          title="Create row"
          disabled={busy || !table.columns.length || table.columnCount !== table.columns.length}
          onClick={() => data.openEditor()}
        />
        {hasActiveFilters && (
          <Button
            variant="ghost"
            prefix={<Icon name="clear-all" />}
            title="Clear all filters"
            aria-label="Clear all filters"
            disabled={mutationPending}
            onClick={clearFilters}
          />
        )}
        <div className="ml-auto flex items-center gap-2">
          <span role="status" className="text-xs text-(--vscode-descriptionForeground)">
            {mutationPending ? 'Saving...' : pending ? 'Updating...' : ''}
          </span>
          <Button
            variant="ghost"
            prefix={<Icon name="refresh" className={pending ? 'animate-spin motion-reduce:animate-none' : undefined} />}
            title="Refresh data"
            aria-label="Refresh data"
            disabled={busy}
            onClick={data.refresh}
          />
        </div>
      </div>
      {error && !data.editor && (
        <div
          role="alert"
          className="flex shrink-0 items-start gap-2 border-b border-(--vscode-panel-border) bg-(--vscode-inputValidation-errorBackground) px-4 py-2 text-(--vscode-errorForeground)"
        >
          <Icon name="warning" />
          <span className="min-w-0 flex-1 wrap-break-word">{error}</span>
          <Button
            variant="ghost"
            prefix={<Icon name="refresh" size="sm" />}
            aria-label="Retry query"
            title="Retry query"
            disabled={busy}
            onClick={data.refresh}
          />
        </div>
      )}
      <section className="flex min-h-0 flex-1 flex-col" aria-label="Table data" aria-busy={pending}>
        {table.columns.length ? (
          <DataTable
            table={table}
            filters={columnFilters}
            hasActiveFilters={hasActiveFilters}
            disabled={busy}
            mutationPending={mutationPending}
            onFilterChange={data.setColumnFilter}
            onClearFilters={clearFilters}
            onEdit={data.openEditor}
            onDelete={(original) => data.mutate({ operation: 'delete', values: {}, original })}
          />
        ) : (
          <div className="grid min-h-0 flex-1 place-items-center">
            <Empty icon="table" title="No columns found" description="This table has no columns." />
          </div>
        )}
      </section>
      <footer className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-t border-(--vscode-panel-border) px-2 py-1 text-xs text-(--vscode-descriptionForeground)">
        <span className="shrink-0 tabular-nums">
          {totalRows && table.rows.length
            ? `${firstRow.toLocaleString()}-${lastRow.toLocaleString()} of ${totalRows.toLocaleString()} rows`
            : '0 rows'}
        </span>
        {table.columnCount > table.columns.length && (
          <span>
            Showing {table.columns.length} of {table.columnCount} columns
          </span>
        )}
        <nav aria-label="Pagination" className="ml-auto flex shrink-0 items-center gap-2 tabular-nums">
          <Button
            variant="ghost"
            size="sm"
            title="Previous page"
            aria-label="Previous page"
            prefix={<Icon name="chevron-left" size="sm" />}
            disabled={busy || displayedPage === 0}
            onClick={() => setPage(displayedPage - 1)}
          />
          <span className="text-center">
            {displayedPage + 1} / {pageCount.toLocaleString()}
          </span>
          <Button
            variant="ghost"
            size="sm"
            title="Next page"
            aria-label="Next page"
            prefix={<Icon name="chevron-right" size="sm" />}
            disabled={busy || displayedPage + 1 >= pageCount}
            onClick={() => setPage(displayedPage + 1)}
          />
        </nav>
      </footer>
      {data.editor && (
        <RowEditor
          table={table}
          original={data.editor.original}
          pending={mutationPending}
          error={data.mutationError}
          onClose={data.closeEditor}
          onSave={data.mutate}
        />
      )}
    </main>
  );
}

mountWebview('root', <App />);
