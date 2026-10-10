import { useState } from 'react';
import { Button } from '@/webview/components/button';
import { Dialog } from '@/webview/components/dialog';
import { Icon } from '@/webview/components/icons';
import { Input } from '@/webview/components/input';
import { Popover } from '@/webview/components/popover';

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
  const [search, setSearch] = useState('');
  const [creatingDatabase, setCreatingDatabase] = useState(false);
  const [newDatabaseName, setNewDatabaseName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [deletingDatabase, setDeletingDatabase] = useState<string | null>(null);

  const query = search.trim().toLowerCase();
  const filteredDatabases = query ? databases.filter((db) => db.toLowerCase().includes(query)) : databases;

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
            className="h-7 max-w-48 gap-1.5 px-2 text-xs font-normal"
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
          {databases.length > 5 && (
            <div className="border-b border-(--vscode-panel-border) p-1.5">
              <Input
                type="search"
                placeholder="Filter databases..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                prefix={<Icon name="search" size="sm" variant="muted" />}
                className="h-6 text-xs"
                autoFocus
              />
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-auto p-1">
            {filteredDatabases.length === 0 ? (
              <div className="p-2 text-center text-xs text-(--vscode-descriptionForeground)">No databases found</div>
            ) : (
              filteredDatabases.map((db) => {
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
                    <Icon name="database" size="sm" variant={isSelected ? 'default' : 'muted'} />
                    <span className="flex-1 truncate" title={db}>
                      {db}
                    </span>
                    {isSelected && <Icon name="check" size="sm" className="shrink-0" />}
                    {!isSystem && (
                      <button
                        type="button"
                        title={`Delete database ${db}`}
                        aria-label={`Delete database ${db}`}
                        className="invisible size-5 shrink-0 items-center justify-center rounded-sm hover:bg-(--vscode-toolbar-hoverBackground) hover:text-(--vscode-errorForeground) group-hover:inline-flex"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpen(false);
                          setDeletingDatabase(db);
                        }}
                      >
                        <Icon name="trash" size="sm" />
                      </button>
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
          footer={
            <>
              <Button variant="secondary" onClick={() => setDeletingDatabase(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  const target = deletingDatabase;
                  setDeletingDatabase(null);
                  onDeleteDatabase(target);
                }}
              >
                Delete
              </Button>
            </>
          }
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
          footer={
            <>
              <Button variant="secondary" onClick={() => setCreatingDatabase(false)}>
                Cancel
              </Button>
              <Button variant="primary" disabled={!newDatabaseName.trim()} onClick={handleCreateSubmit}>
                Create
              </Button>
            </>
          }
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleCreateSubmit();
            }}
            className="flex flex-col gap-2 py-2"
          >
            <label htmlFor="database-name-input" className="text-xs font-medium">
              Database Name
            </label>
            <Input
              id="database-name-input"
              value={newDatabaseName}
              onChange={(e) => {
                setNewDatabaseName(e.target.value);
                setCreateError(null);
              }}
              placeholder="e.g. my_database"
              autoFocus
            />
            {createError && (
              <p className="text-xs text-(--vscode-errorForeground)" role="alert">
                {createError}
              </p>
            )}
          </form>
        </Dialog>
      )}
    </>
  );
}
