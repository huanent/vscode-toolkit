import { DisclosureIcon, FileIcon } from '@/webview/components/icons';
import { Empty } from '@/webview/components/empty';
import { Loading } from '@/webview/components/loading';
import { Tree } from '@/webview/components/tree';
import type { OpenTempFileRequest, TempTreeEntry } from '@/features/temp/protocol';
import { postToHost } from '@/webview/utils/host-data';

type TempPanelProps = {
  entries: TempTreeEntry[] | undefined;
  error: string | undefined;
  loading: boolean;
};

export function TempPanel({ entries, error, loading }: TempPanelProps) {
  return (
    <section className="flex min-h-64 flex-col">
      {error && !entries ? (
        <p className="wrap-break-word text-sm text-(--vscode-errorForeground)" role="alert">
          {error}
        </p>
      ) : loading ? (
        <Loading label="Reading temporary files..." />
      ) : entries?.length ? (
        <div className="min-h-0 flex-1 overflow-auto">
          <Tree
            ariaLabel="Temporary files"
            items={entries}
            getChildren={(entry) => entry.children ?? []}
            getKey={getTempEntryPath}
            getLabel={(entry) => entry.name}
            isBranch={(entry) => entry.type === 'directory'}
            onActivate={(entry, path) => {
              if (entry.type === 'file') {
                postToHost({ type: 'openTempFile', path: getTempEntryPath(path) } satisfies OpenTempFileRequest);
              }
            }}
            renderExpandIcon={(expanded) => <DisclosureIcon expanded={expanded} />}
            renderItem={(entry, { path }) => (
              <>
                {entry.type === 'file' && <FileIcon />}
                <span
                  className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap"
                  title={getTempEntryPath(path)}
                >
                  {entry.name}
                </span>
              </>
            )}
          />
        </div>
      ) : (
        <Empty label="Temporary files" title="No temporary files" description="The temp directory is empty." icon="∅" />
      )}

      {error && entries ? (
        <p className="mt-2 wrap-break-word text-sm text-(--vscode-errorForeground)" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function getTempEntryPath(path: readonly TempTreeEntry[]): string {
  return path.map((entry) => entry.name).join('/');
}
