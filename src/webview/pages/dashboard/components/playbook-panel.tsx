import type { PlaybookRecordEntry, PlaybookRunRequest } from '@/features/playbook/protocol';
import { Button } from '@/webview/components/ui/button';
import { Empty } from '@/webview/components/ui/empty';
import { ErrorMessage } from '@/webview/components/ui/error-message';
import { Icon } from '@/webview/components/ui/icons';
import { Loading } from '@/webview/components/ui/loading';
import { Tree, type TreeFileItem, type TreeItem } from '@/webview/components/ui/tree';
import { postToHost } from '@/webview/utils/host-data';

type PlaybookPanelProps = {
  entries: PlaybookRecordEntry[] | undefined;
  error: string | undefined;
  loading: boolean;
  collapseAllTrigger: number;
};

const panelContext = JSON.stringify({ webviewSection: 'playbook', preventDefaultContextMenuItems: true });

export function PlaybookPanel({ entries, error, loading, collapseAllTrigger }: PlaybookPanelProps) {
  return (
    <section className="flex h-full min-h-0 flex-col" data-vscode-context={panelContext}>
      {error && !entries ? (
        <ErrorMessage message={error} />
      ) : loading ? (
        <Loading label="Reading playbook files..." />
      ) : entries?.length ? (
        <div className="min-h-0 flex-1 overflow-auto">
          <Tree
            ariaLabel="Playbook files"
            collapseAllTrigger={collapseAllTrigger}
            items={toPlaybookTreeItems(entries)}
            onActivate={activatePlaybook}
            onItemDoubleClick={activatePlaybook}
            renderActions={renderPlaybookActions}
          />
        </div>
      ) : (
        <Empty title="No playbooks" description="The playbook directory is empty." icon="run-coverage" />
      )}

      {error && entries ? <ErrorMessage message={error} /> : null}
    </section>
  );
}

function activatePlaybook(item: TreeFileItem) {
  const id = item.context?.playbookId;
  if (typeof id === 'string') postToHost({ type: 'runPlaybookFile', id } satisfies PlaybookRunRequest);
}

function renderPlaybookActions(item: TreeFileItem) {
  const id = item.context?.playbookId;
  if (typeof id !== 'string') return null;
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label="Run playbook"
      title="Run playbook"
      prefix={<Icon name="play" />}
      onClick={() => activatePlaybook(item)}
    />
  );
}

function toPlaybookTreeItems(entries: readonly PlaybookRecordEntry[]): TreeItem[] {
  const entriesByParent = new Map<string | undefined, PlaybookRecordEntry[]>();
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
      if (entry.type === 'playbook') {
        items.push({
          path: itemPath,
          name: entry.name,
          type: 'file',
          icon: 'run-coverage',
          context: {
            playbookId: entry.id,
            playbookName: entry.name,
            ...(entry.parentId ? { playbookParentId: entry.parentId } : {}),
          },
        });
      } else {
        const nextAncestors = new Set(ancestors).add(entry.id);
        items.push({
          path: itemPath,
          name: entry.name,
          type: 'directory',
          context: { playbookFolderId: entry.id, playbookName: entry.name },
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
