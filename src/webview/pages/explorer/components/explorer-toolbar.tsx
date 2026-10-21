import { AddressBar } from '@/webview/components/address-bar';
import type { AddressSegment } from '@/webview/components/address-breadcrumb';
import { Button } from '@/webview/components/ui/button';
import { Icon } from '@/webview/components/ui/icons';
import { SegmentedControl } from '@/webview/components/ui/segmented-control';

export type ExplorerViewMode = 'list' | 'grid';

type ExplorerToolbarProps = {
  address: string;
  addressSegments: AddressSegment[];
  canGoBack: boolean;
  favorites: readonly string[];
  onToggleFavorite: (address: string) => void;
  viewMode: ExplorerViewMode;
  onBack: () => void;
  /** Returns whether the address navigation request was accepted. */
  onAddressSubmit: (address: string) => boolean;
  onNavigate: (location: string | null) => void;
  segmentContext: (segment: AddressSegment) => Record<string, unknown>;
  onViewModeChange: (mode: ExplorerViewMode) => void;
};

export function ExplorerToolbar({
  address,
  addressSegments,
  canGoBack,
  favorites,
  onToggleFavorite,
  viewMode,
  onBack,
  onAddressSubmit,
  onNavigate,
  segmentContext,
  onViewModeChange,
}: ExplorerToolbarProps) {
  return (
    <header className="flex items-center gap-1 border-b border-(--vscode-panel-border) p-1 shrink-0">
      <Button
        variant="ghost"
        aria-label="Back"
        disabled={!canGoBack}
        onClick={onBack}
        prefix={<Icon name="arrow-left" />}
      />
      <AddressBar
        address={address}
        segments={addressSegments}
        favorites={favorites}
        onToggleFavorite={onToggleFavorite}
        onSubmit={onAddressSubmit}
        onNavigate={onNavigate}
        segmentContext={segmentContext}
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
