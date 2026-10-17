import type { DatabaseTable } from '@/features/database/protocol';
import { Button } from '@/webview/components/ui/button';
import { DataList, type DataListColumn } from '@/webview/components/ui/data-list';
import { Icon } from '@/webview/components/ui/icons';
import { postToHost } from '@/webview/utils/host-data';

interface TableManagementProps {
  tables: readonly DatabaseTable[];
  onEditSchema: (table: DatabaseTable) => void;
}

function getTableColumns(onEditSchema: (table: DatabaseTable) => void): readonly DataListColumn<DatabaseTable>[] {
  return [
    {
      key: 'name',
      header: 'Name',
      className: 'flex-1',
      headerClassName: 'pl-4',
      cell: (table) => (
        <div className="flex min-w-0 items-center gap-1">
          <Icon name="table" />
          <span className="truncate" title={table.name}>
            {table.name}
          </span>
        </div>
      ),
    },
    {
      key: 'columns',
      header: 'Columns',
      align: 'right',
      className: 'w-20 shrink-0 whitespace-nowrap tabular-nums',
      cell: (table) => <div className="text-(--vscode-descriptionForeground)">{table.columnCount}</div>,
    },
    {
      key: 'primaryKey',
      header: 'Primary key',
      className: 'w-36 shrink-0 whitespace-nowrap',
      cell: (table) => {
        const primaryKeys = table.columns.filter((column) => column.primaryKey).map((column) => column.name);
        return (
          <div className="truncate text-(--vscode-descriptionForeground)" title={primaryKeys.join(', ')}>
            {primaryKeys.length ? primaryKeys.join(', ') : 'None'}
          </div>
        );
      },
    },
    {
      key: 'rows',
      header: 'Rows',
      align: 'right',
      className: 'w-28 shrink-0 whitespace-nowrap tabular-nums',
      cell: (table) => (
        <div className="text-(--vscode-descriptionForeground)">
          {table.rowCountKnown === false ? 'Not counted' : table.rowCount.toLocaleString()}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'w-20 shrink-0',
      align: 'right',
      cell: (table) => (
        <div className="flex justify-end gap-1">
          <Button
            type="button"
            title="Edit schema"
            aria-label={`Edit schema for ${table.name}`}
            onClick={(event) => {
              event.stopPropagation();
              onEditSchema(table);
            }}
            prefix={<Icon name="edit" />}
            variant="ghost"
            size="sm"
          />
          <Button
            type="button"
            title="Delete table"
            aria-label={`Delete table ${table.name}`}
            onClick={(event) => {
              event.stopPropagation();
              postToHost({ type: 'deleteTable', tableName: table.name });
            }}
            prefix={<Icon name="trash" />}
            variant="ghost"
            size="sm"
          />
        </div>
      ),
    },
  ];
}

export function TableManagement({ tables, onEditSchema }: TableManagementProps) {
  const columns = getTableColumns(onEditSchema);

  return (
    <DataList
      ariaLabel="Database tables"
      columns={columns}
      entries={tables}
      entryKey={(table) => table.name}
      onOpen={(table) => {
        postToHost({ type: 'activeTableChanged', tableName: table.name });
        postToHost({ type: 'openTable', tableName: table.name });
      }}
      emptyMessage="No matching tables."
      className="min-h-0 flex-1"
    />
  );
}
