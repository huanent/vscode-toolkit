import { useState } from 'react';
import type { AssetSummary } from '@/features/assets/protocol';
import { Icon } from '@/webview/components/ui/icons';
import { Popover } from '@/webview/components/ui/popover';
import { fieldClassName } from '@/webview/components/ui/surface-styles';
import { Tree, type TreeItem } from '@/webview/components/ui/tree';
import { cn } from 'cn';

type AssetSelectProps = {
  assets: readonly AssetSummary[];
  filter?: (asset: AssetSummary) => boolean;
  value?: string;
  onValueChange: (value: string) => void;
  ariaLabel: string;
  placeholder?: string;
};

export function AssetSelect({
  assets,
  filter,
  value,
  onValueChange,
  ariaLabel,
  placeholder = 'Select an asset',
}: AssetSelectProps) {
  const [open, setOpen] = useState(false);
  const options = filter ? assets.filter(filter) : assets;
  const selected = options.find((asset) => asset.id === value);
  const items: TreeItem[] = [];
  const directories = new Map<string, Extract<TreeItem, { type: 'directory' }>>();
  const assetIds = new Map<string, string>();
  for (const asset of options) {
    let children = items;
    let folderPath = '';
    for (const segment of asset.folder?.split('/').filter(Boolean) ?? []) {
      folderPath = folderPath ? `${folderPath}/${segment}` : segment;
      let directory = directories.get(folderPath);
      if (!directory) {
        directory = { type: 'directory', path: folderPath, name: segment, children: [] };
        directories.set(folderPath, directory);
        children.push(directory);
      }
      children = directory.children as TreeItem[];
    }
    const path = `${folderPath ? `${folderPath}/` : ''}${asset.id}`;
    assetIds.set(path, asset.id);
    children.push({
      type: 'file',
      path,
      name: asset.name,
      icon: asset.type === 'ssh' ? 'remote' : 'file',
      detail: asset.host ? `${asset.host}${asset.port === undefined ? '' : `:${asset.port}`}` : undefined,
    });
  }
  const label = selected
    ? `${selected.name}${selected.host ? ` (${selected.host}${selected.port === undefined ? '' : `:${selected.port}`})` : ''}`
    : placeholder;

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      align="start"
      className="w-(--anchor-width) max-w-(--available-width)"
      trigger={
        <button
          type="button"
          aria-label={ariaLabel}
          title={label}
          className={cn(fieldClassName, 'flex items-center justify-between gap-2 text-left')}
        >
          <span className={cn('min-w-0 flex-1 truncate', !selected && 'text-(--vscode-input-placeholderForeground)')}>
            {label}
          </span>
          <Icon name="chevron-down" size="sm" />
        </button>
      }
    >
      <div className="max-h-72 overflow-auto py-1">
        {open && options.length > 0 && (
          <Tree
            ariaLabel={ariaLabel}
            items={items}
            onActivate={(item) => {
              const id = assetIds.get(item.path);
              if (id === undefined) return;
              onValueChange(id);
              setOpen(false);
            }}
          />
        )}
        {options.length === 0 && (
          <div className="px-2 py-1 text-(--vscode-descriptionForeground)">No assets available</div>
        )}
      </div>
    </Popover>
  );
}
