import { useState } from 'react';
import { Button } from '@/webview/components/button';
import { Icon } from '@/webview/components/icons';
import { Input } from '@/webview/components/input';
import { SegmentedControl } from '@/webview/components/segmented-control';

export type ExplorerViewMode = 'list' | 'grid';

type ExplorerToolbarProps = {
  address: string;
  canGoBack: boolean;
  viewMode: ExplorerViewMode;
  onBack: () => void;
  /** Returns `false` when the address does not match a folder. */
  onAddressSubmit: (address: string) => boolean;
  onViewModeChange: (mode: ExplorerViewMode) => void;
};

export function ExplorerToolbar({
  address,
  canGoBack,
  viewMode,
  onBack,
  onAddressSubmit,
  onViewModeChange,
}: ExplorerToolbarProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);

  const resetDraft = () => {
    setDraft(null);
    setInvalid(false);
  };

  return (
    <header className="flex items-center gap-1 border-b border-(--vscode-panel-border) p-1">
      <Button
        variant="ghost"
        size="md"
        aria-label="Back"
        disabled={!canGoBack}
        onClick={onBack}
        prefix={<Icon name="arrow-left" />}
      />
      <Input
        aria-label="Address"
        aria-invalid={invalid || undefined}
        className="min-w-0 flex-1"
        value={draft ?? address}
        onChange={(event) => {
          setDraft(event.target.value);
          setInvalid(false);
        }}
        onBlur={resetDraft}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            resetDraft();
          } else if (event.key === 'Enter') {
            if (onAddressSubmit(draft ?? address)) resetDraft();
            else setInvalid(true);
          }
        }}
      />
      <SegmentedControl<ExplorerViewMode>
        ariaLabel="View mode"
        value={viewMode}
        onValueChange={onViewModeChange}
        options={[
          {
            value: 'list',
            label: (
              <>
                <Icon name="list-unordered" size="sm" />
                <span className="sr-only">List</span>
              </>
            ),
          },
          {
            value: 'grid',
            label: (
              <>
                <Icon name="gather" size="sm" />
                <span className="sr-only">Grid</span>
              </>
            ),
          },
        ]}
      />
    </header>
  );
}
