import type { WorkflowRecordEntry, WorkflowRunRequest } from '@/features/workflow/protocol';
import { Button } from '@/webview/components/button';
import { Empty } from '@/webview/components/empty';
import { ErrorMessage } from '@/webview/components/error-message';
import { Icon } from '@/webview/components/icons';
import { Loading } from '@/webview/components/loading';
import { Tree, type TreeFileItem, type TreeItem } from '@/webview/components/tree';
import { postToHost } from '@/webview/utils/host-data';

type WorkflowPanelProps = {
  entries: WorkflowRecordEntry[] | undefined;
  error: string | undefined;
  loading: boolean;
  collapseAllTrigger: number;
};

const panelContext = JSON.stringify({ webviewSection: 'workflow', preventDefaultContextMenuItems: true });

export function WorkflowPanel({ entries, error, loading, collapseAllTrigger }: WorkflowPanelProps) {
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
            collapseAllTrigger={collapseAllTrigger}
            items={toWorkflowTreeItems(entries)}
            onActivate={activateWorkflow}
            onItemDoubleClick={activateWorkflow}
            renderActions={renderWorkflowActions}
          />
        </div>
      ) : (
        <Empty title="No workflows" description="The workflow directory is empty." icon="github-action" />
      )}

      {error && entries ? <ErrorMessage message={error} className="mt-2" /> : null}
    </section>
  );
}

function activateWorkflow(item: TreeFileItem) {
  const id = item.context?.workflowId;
  if (typeof id === 'string') postToHost({ type: 'runWorkflowFile', id } satisfies WorkflowRunRequest);
}

function renderWorkflowActions(item: TreeFileItem) {
  const id = item.context?.workflowId;
  if (typeof id !== 'string') return null;
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label="Run workflow"
      title="Run workflow"
      prefix={<Icon name="play" />}
      onClick={() => activateWorkflow(item)}
    />
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
  const buildItems = (parentId: string | undefined, ancestors: ReadonlySet<string>): TreeItem[] => {
    const items: TreeItem[] = [];
    for (const entry of entriesByParent.get(parentId) ?? []) {
      if (visited.has(entry.id) || ancestors.has(entry.id)) continue;
      visited.add(entry.id);
      const itemPath = entry.type === 'folder' ? entry.id : `${parentId ? `${parentId}/` : ''}${entry.id}.json`;
      if (entry.type === 'workflow') {
        items.push({
          path: itemPath,
          name: entry.name,
          type: 'file',
          icon: 'github-action',
          context: {
            workflowId: entry.id,
            workflowName: entry.name,
            ...(entry.parentId ? { workflowParentId: entry.parentId } : {}),
          },
        });
      } else {
        const nextAncestors = new Set(ancestors).add(entry.id);
        items.push({
          path: itemPath,
          name: entry.name,
          type: 'directory',
          context: { workflowFolderId: entry.id, workflowName: entry.name },
          children: buildItems(entry.id, nextAncestors),
        });
      }
    }
    return items;
  };

  const roots = buildItems(undefined, new Set());
  for (const entry of entries) {
    if (!visited.has(entry.id)) roots.push(...buildItems(entry.id, new Set()));
  }
  return roots;
}
