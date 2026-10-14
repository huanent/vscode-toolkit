import { useState } from 'react';
import { Button } from '@/webview/components/button';
import { Icon } from '@/webview/components/icons';
import { Input } from '@/webview/components/input';
import { SegmentedControl } from '@/webview/components/segmented-control';
import { AddressBreadcrumb } from '@/webview/pages/explorer/components/address-breadcrumb';
import type { AddressSegment } from '@/webview/pages/explorer/explorer-location';

export type ExplorerViewMode = 'list' | 'grid';

type ExplorerToolbarProps = {
  address: string;
  addressSegments: AddressSegment[];
  canGoBack: boolean;
  viewMode: ExplorerViewMode;
  onBack: () => void;
  /** Returns whether the address navigation request was accepted. */
  onAddressSubmit: (address: string) => boolean;
  onNavigate: (location: string | null) => void;
  onViewModeChange: (mode: ExplorerViewMode) => void;
};

export function ExplorerToolbar({
  address,
  addressSegments,
  canGoBack,
  viewMode,
  onBack,
  onAddressSubmit,
  onNavigate,
  onViewModeChange,
}: ExplorerToolbarProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [invalid, setInvalid] = useState(false);

  const startEditing = () => {
    setDraft(address);
    setEditing(true);
  };

  const stopEditing = () => {
    setEditing(false);
    setInvalid(false);
  };

  return (
    <header className="flex items-center gap-1 border-b border-(--vscode-panel-border) px-2 py-1 shrink-0">
      <Button
        variant="ghost"
        aria-label="Back"
        disabled={!canGoBack}
        onClick={onBack}
        prefix={<Icon name="arrow-left" />}
      />
      {editing ? (
        <Input
          autoFocus
          aria-label="Address"
          aria-invalid={invalid || undefined}
          className="h-7! min-w-0 flex-1 rounded-md"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setInvalid(false);
          }}
          onBlur={stopEditing}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              stopEditing();
            } else if (event.key === 'Enter') {
              if (onAddressSubmit(draft)) stopEditing();
              else setInvalid(true);
            }
          }}
        />
      ) : (
        <AddressBreadcrumb segments={addressSegments} onNavigate={onNavigate} onEdit={startEditing} />
      )}
      <SegmentedControl<ExplorerViewMode>
        ariaLabel="View mode"
        value={viewMode}
        onValueChange={onViewModeChange}
        options={[
          {
            value: 'list',
            label: (
              <>
                <Icon name="three-bars" />
                <span className="sr-only">List</span>
              </>
            ),
          },
          {
            value: 'grid',
            label: (
              <>
                <Icon name="microsoft" />
                <span className="sr-only">Grid</span>
              </>
            ),
          },
        ]}
      />
    </header>
  );
}
