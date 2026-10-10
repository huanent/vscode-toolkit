import { Empty } from '@/webview/components/empty';
import { ErrorMessage } from '@/webview/components/error-message';
import { Loading } from '@/webview/components/loading';
import { Tree, type TreeItem } from '@/webview/components/tree';
import type { OpenWorkflowFileRequest, WorkflowTreeEntry } from '@/features/workflow/protocol';
import { postToHost } from '@/webview/utils/host-data';

type WorkflowPanelProps = {
  entries: WorkflowTreeEntry[] | undefined;
  error: string | undefined;
  loading: boolean;
};

const panelContext = JSON.stringify({ webviewSection: 'workflow', preventDefaultContextMenuItems: true });

export function WorkflowPanel({ entries, error, loading }: WorkflowPanelProps) {
  return (
    <section className="flex h-full min-h-0 flex-col" data-vscode-context={panelContext}>
      {error && !entries ? (
        <ErrorMessage message={error} />
      ) : loading ? (
        <Loading label="Reading workfloworary files..." />
      ) : entries?.length ? (
        <div className="min-h-0 flex-1 overflow-auto">
          <Tree
            ariaLabel="Workfloworary files"
            items={toWorkflowTreeItems(entries)}
            onActivate={(item) => {
              if (item.type === 'file') {
                postToHost({ type: 'openWorkflowFile', path: item.path } satisfies OpenWorkflowFileRequest);
              }
            }}
          />
        </div>
      ) : (
        <Empty title="No workflows" description="The workflow directory is empty." icon="debug-line-by-line" />
      )}

      {error && entries ? <ErrorMessage message={error} className="mt-2" /> : null}
    </section>
  );
}

function toWorkflowTreeItems(entries: readonly WorkflowTreeEntry[], parentPath = ''): TreeItem[] {
  return entries.map((entry) => {
    const path = parentPath ? `${parentPath}/${entry.name}` : entry.name;
    const context = { workflowEntryPath: path, workflowEntryType: entry.type };
    return entry.type === 'directory'
      ? {
          path,
          name: entry.name,
          type: 'directory' as const,
          context,
          children: entry.children ? toWorkflowTreeItems(entry.children, path) : undefined,
        }
      : { path, name: entry.name, type: 'file' as const, context };
  });
}
