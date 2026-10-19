import { useEffect, useRef, useState } from 'react';
import type { ArchiveChildrenResult, ArchiveTreeEntry } from '@/features/archive/protocol';
import { Empty } from '@/webview/components/ui/empty';
import { ErrorMessage } from '@/webview/components/ui/error-message';
import { Loading } from '@/webview/components/ui/loading';
import { Tree, type TreeItem } from '@/webview/components/ui/tree';
import { formatSize } from '@/webview/utils/format';
import { postToHost } from '@/webview/utils/host-data';

export function ArchiveTree({
  entries,
  name,
  collapseAllTrigger,
}: {
  entries: readonly ArchiveTreeEntry[];
  name: string;
  collapseAllTrigger?: number;
}) {
  const [children, setChildren] = useState<Record<string, ArchiveTreeEntry[]>>({});
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const pending = useRef(new Set<string>());

  useEffect(() => {
    const onMessage = (event: MessageEvent<ArchiveChildrenResult>) => {
      const message = event.data;
      if (message?.type !== 'archiveChildren' || !pending.current.delete(message.path)) return;
      setLoading(pending.current.size > 0);
      if (message.error) setError(message.error);
      else if (message.entries) setChildren((current) => ({ ...current, [message.path]: message.entries! }));
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  return entries.length ? (
    <>
      {error && <ErrorMessage message={error} />}
      <Tree
        ariaLabel={`${name} contents`}
        collapseAllTrigger={collapseAllTrigger}
        items={toTreeItems(entries, children)}
        onExpand={(item) => {
          if (Object.hasOwn(children, item.path) || pending.current.has(item.path)) return;
          pending.current.add(item.path);
          setError(undefined);
          setLoading(true);
          postToHost({ type: 'loadArchiveChildren', path: item.path });
        }}
      />
      {loading && <Loading label="Reading directory..." />}
    </>
  ) : (
    <Empty title="Archive is empty" description="This archive contains no files or directories." icon="file-zip" />
  );
}

function toTreeItems(
  entries: readonly ArchiveTreeEntry[],
  loadedChildren: Readonly<Record<string, ArchiveTreeEntry[]>>,
  parentPath = '',
): TreeItem[] {
  return entries.map((entry) => {
    const path = parentPath ? `${parentPath}/${entry.name}` : entry.name;
    return entry.type === 'directory'
      ? {
          path,
          name: entry.name,
          type: 'directory',
          children: loadedChildren[path] ? toTreeItems(loadedChildren[path], loadedChildren, path) : undefined,
        }
      : { path, name: entry.name, type: 'file', detail: formatSize(entry.size) };
  });
}
