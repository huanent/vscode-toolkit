import { useState } from 'react';
import { Autocomplete } from '@/webview/components/ui/autocomplete';
import { Button } from '@/webview/components/ui/button';
import { Icon } from '@/webview/components/ui/icons';
import { AddressBreadcrumb, type AddressSegment } from '@/webview/components/address-breadcrumb';

export function AddressBar({
  address,
  segments,
  favorites,
  onToggleFavorite,
  onSubmit,
  onNavigate,
  segmentContext,
  disabled = false,
}: {
  address: string;
  segments: AddressSegment[];
  favorites: readonly string[];
  onToggleFavorite: (address: string) => void;
  onSubmit: (address: string) => boolean;
  onNavigate: (location: string | null) => void;
  segmentContext?: (segment: AddressSegment) => Record<string, unknown>;
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [invalid, setInvalid] = useState(false);
  const isFavorite = favorites.includes(address);
  const favoriteLabel = isFavorite ? 'Remove from favorites' : 'Add to favorites';
  const stopEditing = () => {
    setEditing(false);
    setInvalid(false);
  };
  const favoriteButton = (
    <Button
      variant="ghost"
      size="sm"
      aria-label={favoriteLabel}
      title={favoriteLabel}
      aria-pressed={isFavorite}
      disabled={disabled || !address}
      prefix={<Icon name={isFavorite ? 'star-full' : 'star-empty'} />}
      onMouseDown={(event) => event.preventDefault()}
      onClick={(event) => {
        event.stopPropagation();
        onToggleFavorite(address);
      }}
    />
  );
  return editing ? (
    <div className="min-w-0 flex-1 [&>div>div]:h-7">
      <Autocomplete
        autoFocus
        showTrigger={false}
        defaultOpen={favorites.length > 0}
        items={favorites}
        disabled={disabled}
        onItemSelect={(value) => {
          if (onSubmit(value)) stopEditing();
          else setInvalid(true);
        }}
        itemActions={(value) => (
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Remove favorite ${value}`}
            title="Remove from favorites"
            disabled={disabled}
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
          if (event.key === 'Escape') stopEditing();
          else if (event.key === 'Enter') {
            if (onSubmit(draft)) stopEditing();
            else setInvalid(true);
          }
        }}
      />
    </div>
  ) : (
    <AddressBreadcrumb
      segments={segments}
      segmentContext={segmentContext}
      onNavigate={(location) => {
        if (!disabled) onNavigate(location);
      }}
      onEdit={() => {
        if (!disabled) {
          setDraft(address);
          setEditing(true);
        }
      }}
      suffix={favoriteButton}
    />
  );
}
