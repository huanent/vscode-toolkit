import { useState } from 'react';
import { Button } from '@/webview/components/ui/button';
import { Dialog } from '@/webview/components/ui/dialog';
import { Form, FormItem } from '@/webview/components/ui/form';
import { Icon } from '@/webview/components/ui/icons';
import { Input } from '@/webview/components/ui/input';
import { Popover } from '@/webview/components/ui/popover';

interface DatabaseSelectorProps {
  databases: readonly string[];
  currentDatabase: string | undefined;
  onSelectDatabase: (database: string) => void;
  onCreateDatabase: (name: string) => void;
  onDeleteDatabase: (database: string) => void;
  disabled?: boolean;
}

const systemDatabases = new Set(['information_schema', 'mysql', 'performance_schema', 'sys']);

function isSystemDatabase(name: string): boolean {
  return systemDatabases.has(name.toLowerCase());
}

export function DatabaseSelector({
  databases,
  currentDatabase,
  onSelectDatabase,
  onCreateDatabase,
  onDeleteDatabase,
  disabled,
}: DatabaseSelectorProps) {
  const [open, setOpen] = useState(false);
  const [creatingDatabase, setCreatingDatabase] = useState(false);
  const [newDatabaseName, setNewDatabaseName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [deletingDatabase, setDeletingDatabase] = useState<string | null>(null);

  const handleCreateSubmit = () => {
    const trimmed = newDatabaseName.trim();
    if (!trimmed) {
      setCreateError('Database name is required.');
      return;
    }
    if (databases.some((d) => d.toLowerCase() === trimmed.toLowerCase())) {
      setCreateError(`Database "${trimmed}" already exists.`);
      return;
    }
    setCreatingDatabase(false);
    onCreateDatabase(trimmed);
  };

  return (
    <>
      <Popover
        open={open}
        onOpenChange={setOpen}
        align="start"
        trigger={
          <Button
            variant="secondary"
            size="sm"
            className="h-6 max-w-48 gap-1.5 px-2  font-normal"
            title={currentDatabase ? `Database: ${currentDatabase}` : 'Select database'}
            aria-label="Select and manage databases"
            disabled={disabled}
          >
            <Icon name="database" size="sm" variant="muted" />
            <span className="truncate">{currentDatabase ?? 'Select database'}</span>
            <Icon name="chevron-down" size="sm" variant="muted" className="shrink-0" />
          </Button>
        }
      >
        <div className="flex w-64 max-h-80 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-auto p-1">
            {databases.length === 0 ? (
              <div className="p-2 text-center  text-(--vscode-descriptionForeground)">No databases found</div>
            ) : (
              databases.map((db) => {
                const isSelected = db === currentDatabase;
                const isSystem = isSystemDatabase(db);
                return (
                  <div
                    key={db}
                    role="button"
                    tabIndex={0}
                    className={`group flex items-center gap-1.5 rounded-sm px-2 py-1 cursor-pointer select-none hover:bg-(--vscode-list-hoverBackground) hover:text-(--vscode-list-hoverForeground) ${
                      isSelected
                        ? 'bg-(--vscode-list-activeSelectionBackground) text-(--vscode-list-activeSelectionForeground)'
                        : ''
                    }`}
                    onClick={() => {
                      onSelectDatabase(db);
                      setOpen(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        onSelectDatabase(db);
                        setOpen(false);
                      }
                    }}
                  >
                    <Icon name="database" variant={isSelected ? 'default' : 'muted'} />
                    <span className="flex-1 truncate" title={db}>
                      {db}
                    </span>
                    {!isSystem && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
                        title={`Delete database ${db}`}
                        aria-label={`Delete database ${db}`}
                        prefix={<Icon name="trash" />}
                        onKeyDown={(event) => event.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpen(false);
                          setDeletingDatabase(db);
                        }}
                      />
                    )}
                  </div>
                );
              })
            )}
          </div>
          <div className="border-t border-(--vscode-panel-border) p-1">
            <button
              type="button"
              className="flex w-full cursor-pointer items-center gap-1.5 rounded-sm px-2 py-1 text-left hover:bg-(--vscode-list-hoverBackground) hover:text-(--vscode-list-hoverForeground)"
              onClick={() => {
                setOpen(false);
                setNewDatabaseName('');
                setCreateError(null);
                setCreatingDatabase(true);
              }}
            >
              <Icon name="add" size="sm" />
              <span>Create Database...</span>
            </button>
          </div>
        </div>
      </Popover>

      {deletingDatabase && (
        <Dialog
          open={true}
          onOpenChange={(isOpen) => {
            if (!isOpen) setDeletingDatabase(null);
          }}
          title="Delete Database"
          description={`Are you sure you want to delete database "${deletingDatabase}"? This will permanently delete the database and all of its tables.`}
          saveLabel="Delete"
          onSave={() => {
            const target = deletingDatabase;
            setDeletingDatabase(null);
            onDeleteDatabase(target);
          }}
        >
          <div />
        </Dialog>
      )}

      {creatingDatabase && (
        <Dialog
          open={true}
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              setCreatingDatabase(false);
              setCreateError(null);
            }
          }}
          title="Create Database"
          form="create-database-form"
          saveLabel="Create"
        >
          <Form id="create-database-form" onFormSubmit={handleCreateSubmit} className="flex flex-col gap-2 py-2">
            <FormItem name="databaseName" label="Database Name" error="Database name is required." match="valueMissing">
              <Input
                required
                value={newDatabaseName}
                onChange={(e) => {
                  setNewDatabaseName(e.target.value);
                  setCreateError(null);
                }}
                placeholder="e.g. my_database"
                autoFocus
              />
            </FormItem>
            {createError && (
              <p className=" text-(--vscode-errorForeground)" role="alert">
                {createError}
              </p>
            )}
          </Form>
        </Dialog>
      )}
    </>
  );
}
