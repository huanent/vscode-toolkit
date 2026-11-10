import { Empty } from '@/webview/components/ui/empty';
import { ErrorMessage } from '@/webview/components/ui/error-message';
import { Loading } from '@/webview/components/ui/loading';
import { Tree, type TreeItem } from '@/webview/components/ui/tree';
import type {
  OpenTempFileRequest,
  TempFileCommandRequest,
  TempContextTarget,
  TempTreeEntry,
} from '@/features/temp/protocol';
import { postToHost } from '@/webview/utils/host-data';

type TempPanelProps = {
  entries: TempTreeEntry[] | undefined;
  error: string | undefined;
  loading: boolean;
  collapseAllTrigger: number;
  search?: string;
  searchMatches?: readonly string[];
};

const panelContext = JSON.stringify({ webviewSection: 'temp', preventDefaultContextMenuItems: true });

export function TempPanel({ entries, error, loading, collapseAllTrigger, search, searchMatches }: TempPanelProps) {
  return (
    <section
      className="flex h-full min-h-0 flex-col"
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
      ) : entries?.length ? (
        <div className="min-h-0 flex-1 overflow-auto">
          <Tree
            ariaLabel="Temporary files"
            collapseAllTrigger={collapseAllTrigger}
            items={toTempTreeItems(entries)}
            search={search}
            searchMatches={searchMatches}
            onActivate={(item) => {
              if (item.type === 'file') {
                postToHost({ type: 'openTempFile', path: item.path } satisfies OpenTempFileRequest);
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

function toTempTreeItems(entries: readonly TempTreeEntry[], parentPath = ''): TreeItem[] {
  return entries.map((entry) => {
    const path = parentPath ? `${parentPath}/${entry.name}` : entry.name;
    const extensionIndex = entry.name.lastIndexOf('.');
    const context = {
      tempEntryPath: path,
      tempEntryType: entry.type,
      tempEntryExtension: extensionIndex > 0 ? entry.name.slice(extensionIndex).toLowerCase() : '',
    };
    return entry.type === 'directory'
      ? {
          path,
          name: entry.name,
          type: 'directory' as const,
          context,
          children: entry.children ? toTempTreeItems(entry.children, path) : undefined,
        }
      : { path, name: entry.name, type: 'file' as const, context };
  });
}
