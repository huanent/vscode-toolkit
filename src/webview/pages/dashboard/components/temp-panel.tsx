import { Empty } from '@/webview/components/ui/empty';
import { ErrorMessage } from '@/webview/components/ui/error-message';
import { Loading } from '@/webview/components/ui/loading';
import { Icon } from '@/webview/components/ui/icons';
import { Tree, type TreeItem } from '@/webview/components/ui/tree';
import type {
  OpenTempFileRequest,
  TempFileCommandRequest,
  TempContextTarget,
  TempTreeEntry,
  TempScopeGroup,
  TempFilesWebviewMessage,
} from '@/features/temp/protocol';
import type { StorageScope } from '@/shared/storage-scope';
import { postToHost } from '@/webview/utils/host-data';

type TempPanelProps = {
  entries: TempScopeGroup[] | undefined;
  error: string | undefined;
  loading: boolean;
  collapseAllTrigger: number;
  search?: string;
  searchMatches?: readonly string[];
};

const panelContext = JSON.stringify({ webviewSection: 'temp', preventDefaultContextMenuItems: true });

export function TempPanel({ entries, error, loading, collapseAllTrigger, search, searchMatches }: TempPanelProps) {
  const [draft, setDraft] = useState<TempEntryDraft>();
  const closeDraft = useCallback(() => setDraft(undefined), []);
  useEffect(() => {
    const onMessage = (event: MessageEvent<TempFilesWebviewMessage>) => {
      if (event.data.type !== 'beginTempEntry') return;
      setDraft({ ...event.data, requestId: crypto.randomUUID() });
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);
  const targetPath = draft?.target.tempEntryPath;
  const parentPath = draft?.target.tempEntryType === 'file'
    ? targetPath?.slice(0, Math.max(0, targetPath.lastIndexOf('/')))
    : targetPath;
  return (
    <section
      className="temp-panel flex h-full min-h-0 flex-col"
      data-vscode-context={panelContext}
      tabIndex={0}
      onKeyDownCapture={(event) => {
        const key = event.key.toLowerCase();
        const element = event.target as HTMLElement;
        if (element.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
        if (event.altKey) return;
        const modified = event.metaKey || event.ctrlKey;
        let command: TempFileCommandRequest['command'] | undefined;
        if (modified && !event.shiftKey) {
          if (key === 'c') command = 'copy';
          else if (key === 'x') command = 'cut';
          else if (key === 'v') command = 'paste';
          else if (event.metaKey && !event.ctrlKey && key === 'backspace') command = 'delete';
        } else if (modified && event.shiftKey && key === 'c') command = 'copyPath';
        else if (!modified && !event.shiftKey) {
          if (key === 'delete') command = 'delete';
          else if (key === 'f2') command = 'rename';
        }
        if (!command) return;
        event.preventDefault();
        event.stopPropagation();
        if (event.repeat) return;
        const activeId = element.closest('[role="tree"]')?.getAttribute('aria-activedescendant');
        const activeItem = activeId ? element.ownerDocument.getElementById(activeId) : null;
        const context = activeItem?.dataset.vscodeContext;
        const target: TempContextTarget = context ? JSON.parse(context) : {};
        if (command !== 'paste' && !target.tempEntryPath) return;
        postToHost({ ...target, type: 'tempFileCommand', command } satisfies TempFileCommandRequest);
      }}
    >
      {error && !entries ? (
        <ErrorMessage message={error} />
      ) : loading ? (
        <Loading label="Reading temporary files..." />
      ) : draft || entries?.some((group) => group.entries.length > 0) ? (
        <div className="min-h-0 flex-1 overflow-auto">
          <Tree
            ariaLabel="Temporary files"
            collapseAllTrigger={collapseAllTrigger}
            inlineEditor={draft ? {
              parentPath: parentPath ? `${draft.target.tempScope ?? 'global'}:${parentPath}` : undefined,
              content: <TempEntryInput key={draft.requestId} draft={draft} onClose={closeDraft} />,
            } : undefined}
            items={(entries ?? [])
              .flatMap(({ scope, entries: scopeEntries }) => toTempTreeItems(scopeEntries, scope))
              .sort(compareTempItems)}
            search={draft ? undefined : search}
            searchMatches={draft ? undefined : searchMatches}
            renderIndicator={(item) =>
              item.context?.tempScope === 'workspace' ? (
                <div
                  className="flex items-center justify-center pr-0.5 opacity-50"
                  title="Stored in workspace"
                  aria-label="Stored in workspace"
                >
                  <Icon name="file-symlink-file" />
                </div>
              ) : null
            }
            onActivate={(item) => {
              if (item.type === 'file') {
                const { tempEntryPath, tempScope } = item.context ?? {};
                if (typeof tempEntryPath === 'string' && (tempScope === 'global' || tempScope === 'workspace')) {
                  postToHost({
                    type: 'openTempFile',
                    path: tempEntryPath,
                    scope: tempScope,
                  } satisfies OpenTempFileRequest);
                }
              }
            }}
          />
        </div>
      ) : (
        <Empty title="No temporary files" description="The temp directory is empty." icon="history" />
      )}

      {error && entries ? <ErrorMessage message={error} /> : null}
    </section>
  );
}

const entryNameCollator = new Intl.Collator(undefined, { numeric: true });

function compareTempItems(left: TreeItem, right: TreeItem): number {
  return left.type === right.type
    ? entryNameCollator.compare(left.name, right.name)
    : left.type === 'directory'
      ? -1
      : 1;
}

function toTempTreeItems(entries: readonly TempTreeEntry[], scope: StorageScope, parentPath = ''): TreeItem[] {
  return entries.map((entry) => {
    const path = parentPath ? `${parentPath}/${entry.name}` : entry.name;
    const extensionIndex = entry.name.lastIndexOf('.');
    const context = {
      tempScope: scope,
      tempEntryPath: path,
      tempEntryType: entry.type,
      tempEntryExtension: extensionIndex > 0 ? entry.name.slice(extensionIndex).toLowerCase() : '',
    };
    return entry.type === 'directory'
      ? {
          path: `${scope}:${path}`,
          name: entry.name,
          type: 'directory' as const,
          context,
          children: entry.children ? toTempTreeItems(entry.children, scope, path) : undefined,
        }
      : { path: `${scope}:${path}`, name: entry.name, type: 'file' as const, context };
  });
}
import { useCallback, useEffect, useState } from 'react';
import { TempEntryInput, type TempEntryDraft } from './temp-entry-input';
