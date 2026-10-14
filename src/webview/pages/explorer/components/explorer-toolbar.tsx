import { useState } from 'react';
import { Autocomplete } from '@/webview/components/autocomplete';
import { Button } from '@/webview/components/button';
import { Icon } from '@/webview/components/icons';
import { SegmentedControl } from '@/webview/components/segmented-control';
import { AddressBreadcrumb } from '@/webview/pages/explorer/components/address-breadcrumb';
import type { AddressSegment } from '@/webview/pages/explorer/explorer-location';

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
  onViewModeChange,
}: ExplorerToolbarProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [invalid, setInvalid] = useState(false);
  const isFavorite = favorites.includes(address);
  const favoriteLabel = isFavorite ? 'Remove from favorites' : 'Add to favorites';
  const favoriteButton = (
    <Button
      variant="ghost"
      size="sm"
      aria-label={favoriteLabel}
      title={favoriteLabel}
      aria-pressed={isFavorite}
      prefix={<Icon name={isFavorite ? 'star-full' : 'star-empty'} />}
      onMouseDown={(event) => event.preventDefault()}
      onClick={(event) => {
        event.stopPropagation();
        onToggleFavorite(address);
      }}
    />
  );

  const startEditing = () => {
    setDraft(address);
    setEditing(true);
  };

  const stopEditing = () => {
    setEditing(false);
    setInvalid(false);
  };

  return (
    <header className="flex items-center gap-1 border-b border-(--vscode-panel-border) p-1 shrink-0">
      <Button
        variant="ghost"
        aria-label="Back"
        disabled={!canGoBack}
        onClick={onBack}
        prefix={<Icon name="arrow-left" />}
      />
      {editing ? (
        <div className="min-w-0 flex-1">
          <Autocomplete
            autoFocus
            showTrigger={false}
            defaultOpen={favorites.length > 0}
            items={favorites}
            onItemSelect={(value) => {
              if (onAddressSubmit(value)) stopEditing();
              else setInvalid(true);
            }}
            itemActions={(value) => (
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Remove favorite ${value}`}
                title="Remove from favorites"
                prefix={<Icon name="trash" />}
                onMouseDown={(event) => event.preventDefault()}
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleFavorite(value);
                }}
              />
            )}
            suffix={favoriteButton}
            aria-label="Address"
            aria-invalid={invalid || undefined}
            className="min-w-0"
            value={draft}
            onFocus={(event) => event.currentTarget.select()}
            onValueChange={(value) => {
              setDraft(value);
              setInvalid(false);
            }}
            onBlur={stopEditing}
            onKeyDown={(event) => {
              if (event.defaultPrevented) return;
              if (event.key === 'Escape') {
                stopEditing();
              } else if (event.key === 'Enter') {
                if (onAddressSubmit(draft)) stopEditing();
                else setInvalid(true);
              }
            }}
          />
        </div>
      ) : (
        <AddressBreadcrumb
          segments={addressSegments}
          onNavigate={onNavigate}
          onEdit={startEditing}
          suffix={favoriteButton}
        />
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
