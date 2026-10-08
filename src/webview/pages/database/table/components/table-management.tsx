import { useMemo } from 'react';
import type { DatabaseTable } from '@/features/database/protocol';
import { Button } from '@/webview/components/button';
import { Icon } from '@/webview/components/icons';
import { Table, type TableColumn } from '@/webview/components/table';
import { postToHost } from '@/webview/utils/host-data';

interface TableManagementProps {
  tables: readonly DatabaseTable[];
  onEditSchema: (table: DatabaseTable) => void;
}

function getTableColumns(onEditSchema: (table: DatabaseTable) => void): readonly TableColumn<DatabaseTable>[] {
  return [
    {
      key: 'name',
      header: 'Table',
      width: '24rem',
      className: 'min-w-56',
      cell: (table) => (
        <div className="flex min-w-0 items-center gap-2">
          <Icon name="table" variant="muted" size="sm" />
          <span className="min-w-0 truncate font-medium">{table.name}</span>
        </div>
      ),
    },
    {
      key: 'columns',
      header: 'Columns',
      align: 'right',
      width: '7rem',
      className: 'tabular-nums',
      cell: (table) => table.columnCount,
    },
    {
      key: 'primaryKey',
      header: 'Primary key',
      width: '12rem',
      className: 'min-w-36',
      cell: (table) => {
        const primaryKeys = table.columns.filter((column) => column.primaryKey).map((column) => column.name);
        return primaryKeys.length ? (
          <span className="truncate" title={primaryKeys.join(', ')}>
            {primaryKeys.join(', ')}
          </span>
        ) : (
          <span className="text-(--vscode-descriptionForeground)">None</span>
        );
      },
    },
    {
      key: 'rows',
      header: 'Rows',
      align: 'right',
      width: '8rem',
      className: 'tabular-nums',
      cell: (table) => table.rowCount.toLocaleString(),
    },
    {
      key: 'actions',
      header: 'Actions',
      width: '8rem',
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
            icon={<Icon name="edit" size="sm" />}
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
            icon={<Icon name="trash" size="sm" />}
            variant="ghost"
            size="sm"
            className="text-(--vscode-errorForeground) hover:text-(--vscode-errorForeground)"
          />
        </div>
      ),
    },
  ];
}

export function TableManagement({ tables, onEditSchema }: TableManagementProps) {
  const columns = useMemo(() => getTableColumns(onEditSchema), [onEditSchema]);

  return (
    <Table
      ariaLabel="SQLite database tables"
      columns={columns}
      rows={tables}
      rowKey={(table) => table.name}
      onRowClick={(table) => postToHost({ type: 'openTable', tableName: table.name })}
      emptyMessage="No tables found."
      className="min-w-full"
    />
  );
}
