import type { SftpDirectory, SftpEntry, SftpRequest, SftpResources, SftpSide } from '@/features/ssh/protocol';
import { AddressBar } from '@/webview/components/address-bar';
import type { AddressSegment } from '@/webview/components/address-breadcrumb';
import { Button } from '@/webview/components/ui/button';
import { DataList, type DataListColumn } from '@/webview/components/ui/data-list';
import { Icon } from '@/webview/components/ui/icons';
import { formatDateTime, formatSize } from '@/webview/utils/format';
import { getRootData, postToHost } from '@/webview/utils/host-data';

export function FilePane({
  side,
  directory,
  busy,
  favorites,
  resources,
}: {
  side: SftpSide;
  directory?: SftpDirectory;
  busy: boolean;
  favorites: string[];
  resources?: SftpResources;
}) {
  let address = directory?.path ?? '';
  if (side === 'local') {
    address = address.replace(/\\/g, '/');
    if (/^[a-zA-Z]:\//.test(address)) address = `/${address}`;
  }
  const parts = address.split('/').filter(Boolean);
  const drive = side === 'local' && /^[a-zA-Z]:$/.test(parts[0] ?? '') ? parts.shift() : undefined;
  const root = drive ? `/${drive}/` : '/';
  const segments: AddressSegment[] = address ? [{ name: '/', location: root }] : [];
  let ancestor = root.replace(/\/$/, '');
  for (const name of parts) {
    ancestor += `/${name}`;
    segments.push({ name, location: ancestor });
  }
  const label = side === 'local' ? 'Local' : 'Remote';
  const send = (request: SftpRequest) => {
    if (!busy) postToHost(request);
  };
  const navigate = (path: string) => send({ type: 'navigate', side, path });
  const action = (type: 'rename' | 'delete' | 'open' | 'transfer', entry: SftpEntry) =>
    send({ type, side, path: entry.path });
  const parentEntry: SftpEntry | undefined =
    directory && directory.parent !== directory.path
      ? { path: directory.parent, name: '..', type: 'directory', modifiedAt: 0, symbolicLink: false }
      : undefined;
  const columns: DataListColumn<SftpEntry>[] = [
    {
      key: 'name',
      header: 'Name',
      className: 'w-40 flex-1',
      cell: (entry) => (
        <div className="flex min-w-0 items-center gap-1" title={entry.name}>
          <Icon name={entry.symbolicLink ? 'file-symlink-file' : entry.type === 'directory' ? 'folder' : 'file'} />
          <span className="truncate">{entry.name}</span>
        </div>
      ),
    },
    {
      key: 'modified',
      header: 'Modified',
      className: 'w-36 shrink-0',
      cell: (entry) => (
        <span className="whitespace-nowrap text-(--vscode-descriptionForeground)">
          {entry === parentEntry ? '' : formatDateTime(entry.modifiedAt)}
        </span>
      ),
    },
    {
      key: 'permissions',
      header: 'Permissions',
      className: 'w-24 shrink-0',
      cell: (entry) => (
        <span className="font-mono text-(--vscode-descriptionForeground)">
          {entry.mode === undefined ? '-' : (entry.mode & 0o7777).toString(8).padStart(4, '0')}
        </span>
      ),
    },
    {
      key: 'size',
      header: 'Size',
      className: 'w-16 shrink-0',
      align: 'right',
      cell: (entry) => (
        <span className="text-(--vscode-descriptionForeground)">
          {entry.size === undefined ? '-' : formatSize(entry.size)}
        </span>
      ),
    },
  ];

  return (
    <section
      aria-label={`${label} files`}
      aria-busy={busy}
      className="flex min-h-0 min-w-72 flex-1 basis-0 flex-col overflow-hidden border-r border-(--vscode-panel-border) last:border-r-0"
    >
      <div className="flex shrink-0 items-center gap-1 border-b border-(--vscode-panel-border) px-2 py-1">
        <Icon name={side === 'local' ? 'device-desktop' : 'remote'} />
        <h2 className="min-w-0 flex-1 truncate text-sm font-medium">{label}</h2>
        <div className="flex min-w-0 shrink items-center gap-2 overflow-x-auto whitespace-nowrap font-mono text-xs tabular-nums text-(--vscode-descriptionForeground)">
          <span className="grid shrink-0" title="CPU usage">
            <span className="invisible col-start-1 row-start-1" aria-hidden="true">
              CPU 100%
            </span>
            <span className="col-start-1 row-start-1">
              CPU {resources?.cpu === undefined ? '-' : `${resources.cpu.toFixed(0)}%`}
            </span>
          </span>
          <span className="grid shrink-0" title="Memory usage">
            <span className="invisible col-start-1 row-start-1" aria-hidden="true">
              MEM 100%
            </span>
            <span className="col-start-1 row-start-1">
              MEM {resources?.memory === undefined ? '-' : `${resources.memory.toFixed(0)}%`}
            </span>
          </span>
          <span
            className="grid shrink-0"
            title={side === 'local' ? 'Current filesystem usage' : 'Root filesystem usage'}
          >
            <span className="invisible col-start-1 row-start-1" aria-hidden="true">
              Disk 100%
            </span>
            <span className="col-start-1 row-start-1">
              Disk {resources?.disk === undefined ? '-' : `${resources.disk.toFixed(0)}%`}
            </span>
          </span>
          <span className="grid shrink-0" title="Network receive rate">
            <span className="invisible col-start-1 row-start-1" aria-hidden="true">
              In 1024 TB/s
            </span>
            <span className="col-start-1 row-start-1">
              In {resources?.networkIn === undefined ? '-' : `${formatSize(Math.floor(resources.networkIn))}/s`}
            </span>
          </span>
          <span className="grid shrink-0" title="Network send rate">
            <span className="invisible col-start-1 row-start-1" aria-hidden="true">
              Out 1024 TB/s
            </span>
            <span className="col-start-1 row-start-1">
              Out {resources?.networkOut === undefined ? '-' : `${formatSize(Math.floor(resources.networkOut))}/s`}
            </span>
          </span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1 border-b border-(--vscode-panel-border) p-1">
        <Button
          type="button"
          variant="ghost"
          title="Back"
          aria-label={`${label} back`}
          disabled={busy || !directory?.canGoBack}
          prefix={<Icon name="arrow-left" />}
          onClick={() => send({ type: 'back', side })}
        />
        <Button
          type="button"
          variant="ghost"
          title="Refresh"
          aria-label={`Refresh ${side}`}
          disabled={busy}
          prefix={<Icon name="refresh" />}
          onClick={() => navigate(directory?.path ?? '~')}
        />
        <AddressBar
          address={address}
          segments={segments}
          favorites={favorites}
          disabled={busy}
          segmentContext={(segment) => {
            const path =
              side === 'local' && /^\/[a-zA-Z]:\//.test(segment.location ?? '')
                ? segment.location!.slice(1).replace(/\//g, '\\')
                : segment.location;
            return {
              webviewSection: 'sftp',
              preventDefaultContextMenuItems: true,
              sftpAssetId: getRootData('assetId'),
              sftpSide: side,
              sftpEntryPath: path,
              sftpCreatePath: path,
              sftpRoot: segment.location === root,
              sftpBusy: busy,
            };
          }}
          onToggleFavorite={(value) => send({ type: 'toggleFavorite', side, address: value })}
          onSubmit={(value) => {
            if (busy || !value.trim()) return false;
            navigate(value);
            return true;
          }}
          onNavigate={(location) => navigate(location ?? root)}
        />
      </div>
      {directory ? (
        <DataList
          ariaLabel={`${label} files`}
          entries={[
            ...(parentEntry ? [parentEntry] : []),
            ...directory.entries.toSorted(
              (first, second) =>
                Number(second.type === 'directory') - Number(first.type === 'directory') ||
                first.name.localeCompare(second.name, undefined, { numeric: true, sensitivity: 'base' }),
            ),
          ]}
          columns={columns}
          entryKey={(entry) => entry.path}
          entryContext={(entry) =>
            entry === parentEntry
              ? { webviewSection: 'sftp', preventDefaultContextMenuItems: true }
              : {
                  webviewSection: 'sftp',
                  preventDefaultContextMenuItems: true,
                  sftpAssetId: getRootData('assetId'),
                  sftpSide: side,
                  sftpEntryPath: entry.path,
                  sftpCreatePath: entry.type === 'directory' ? entry.path : directory.path,
                  sftpBusy: busy,
                  sftpSymbolicLink: entry.symbolicLink,
                }
          }
          onOpen={(entry) => {
            if (entry.type === 'directory') navigate(entry.path);
            else action('open', entry);
          }}
          emptyMessage="Empty folder"
        />
      ) : (
        <div className="p-4 text-sm text-(--vscode-descriptionForeground)"></div>
      )}
    </section>
  );
}
