import type { SftpDirectory, SftpEntry, SftpRequest, SftpSide } from '@/features/ssh/protocol';
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
}: {
  side: SftpSide;
  directory?: SftpDirectory;
  busy: boolean;
  favorites: string[];
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
          {formatDateTime(entry.modifiedAt)}
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
        <Button
          variant="ghost"
          size="sm"
          title="New file"
          aria-label={`New ${side} file`}
          disabled={busy || !directory}
          prefix={<Icon name="new-file" />}
          onClick={() => send({ type: 'create', side, directory: false })}
        />
        <Button
          variant="ghost"
          size="sm"
          title="New folder"
          aria-label={`New ${side} folder`}
          disabled={busy || !directory}
          prefix={<Icon name="new-folder" />}
          onClick={() => send({ type: 'create', side, directory: true })}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          title="Refresh"
          aria-label={`Refresh ${side}`}
          disabled={busy}
          prefix={<Icon name="refresh" />}
          onClick={() => navigate(directory?.path ?? '~')}
        />
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
        <AddressBar
          address={address}
          segments={segments}
          favorites={favorites}
          disabled={busy}
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
          entries={directory.entries.toSorted(
            (first, second) =>
              Number(second.type === 'directory') - Number(first.type === 'directory') ||
              first.name.localeCompare(second.name, undefined, { numeric: true, sensitivity: 'base' }),
          )}
          columns={columns}
          entryKey={(entry) => entry.path}
          entryContext={(entry) => ({
            webviewSection: 'sftp',
            preventDefaultContextMenuItems: true,
            sftpAssetId: getRootData('assetId'),
            sftpSide: side,
            sftpEntryPath: entry.path,
            sftpBusy: busy,
            sftpSymbolicLink: entry.symbolicLink,
          })}
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
