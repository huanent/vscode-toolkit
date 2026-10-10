import type { WorkflowEditorOpenRequest, WorkflowRecordEntry } from '@/features/workflow/protocol';
import { Empty } from '@/webview/components/empty';
import { ErrorMessage } from '@/webview/components/error-message';
import { Loading } from '@/webview/components/loading';
import { Tree, type TreeItem } from '@/webview/components/tree';
import { postToHost } from '@/webview/utils/host-data';

type WorkflowPanelProps = {
  entries: WorkflowRecordEntry[] | undefined;
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
        <Loading label="Reading workflow files..." />
      ) : entries?.length ? (
        <div className="min-h-0 flex-1 overflow-auto">
          <Tree
            ariaLabel="Workflow files"
            items={toWorkflowTreeItems(entries)}
            onActivate={(item) => {
              const id = item.context?.workflowId;
              if (typeof id !== 'string') return;
              postToHost({ type: 'openWorkflowEditor', id } satisfies WorkflowEditorOpenRequest);
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

function toWorkflowTreeItems(entries: readonly WorkflowRecordEntry[]): TreeItem[] {
  const entriesByParent = new Map<string | undefined, WorkflowRecordEntry[]>();
  const folderIds = new Set(entries.filter((entry) => entry.type === 'folder').map((entry) => entry.id));
  for (const entry of entries) {
    const parentId = entry.parentId && folderIds.has(entry.parentId) ? entry.parentId : undefined;
    const siblings = entriesByParent.get(parentId) ?? [];
    siblings.push(entry);
    entriesByParent.set(parentId, siblings);
  }

  const visited = new Set<string>();
  const buildItems = (parentId: string | undefined, parentPath: string, ancestors: ReadonlySet<string>): TreeItem[] => {
    const items: TreeItem[] = [];
    for (const entry of entriesByParent.get(parentId) ?? []) {
      if (visited.has(entry.id) || ancestors.has(entry.id)) continue;
      visited.add(entry.id);
      const itemPath = parentPath ? `${parentPath}/${entry.id}` : entry.id;
      if (entry.type === 'workflow') {
        items.push({ path: itemPath, name: entry.name, type: 'file', context: { workflowId: entry.id } });
      } else {
        const nextAncestors = new Set(ancestors).add(entry.id);
        items.push({
          path: itemPath,
          name: entry.name,
          type: 'directory',
          context: { workflowFolderId: entry.id },
          children: buildItems(entry.id, itemPath, nextAncestors),
        });
      }
    }
    return items;
  };

  const roots = buildItems(undefined, '', new Set());
  for (const entry of entries) {
    if (!visited.has(entry.id)) roots.push(...buildItems(entry.id, '', new Set()));
  }
  return roots;
}
