import { Fragment } from 'react';
import { cn } from 'cn';
import { Button } from '@/webview/components/button';
import { Icon } from '@/webview/components/icons';
import { fieldClassName } from '@/webview/components/surface-styles';
import type { AddressSegment } from '@/webview/pages/explorer/explorer-location';

type AddressBreadcrumbProps = {
  segments: AddressSegment[];
  onNavigate: (location: string | null) => void;
  onEdit: () => void;
};

export function AddressBreadcrumb({ segments, onNavigate, onEdit }: AddressBreadcrumbProps) {
  const currentIndex = segments.length - 1;

  return (
    <nav
      aria-label="Address"
      tabIndex={0}
      className={cn(fieldClassName, 'flex h-7! min-w-0 flex-1 cursor-text items-center overflow-x-auto')}
      onClick={onEdit}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onEdit();
        }
      }}
    >
      {segments.map((segment, index) => {
        const isCurrent = index === currentIndex;
        return (
          <Fragment key={index}>
            {index > 0 && <Icon name="chevron-right" variant="muted" className="shrink-0" />}
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 whitespace-nowrap"
              aria-label={index === 0 ? 'System root' : undefined}
              aria-current={isCurrent ? 'page' : undefined}
              title={index === 0 ? 'System root' : segment.name}
              onClick={(event) => {
                event.stopPropagation();
                onNavigate(segment.location);
              }}
            >
              {index === 0 ? <Icon name="home" /> : <span className="sm">{segment.name}</span>}
            </Button>
          </Fragment>
        );
      })}
    </nav>
  );
}
