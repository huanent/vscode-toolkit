import { Fragment, type ReactNode } from 'react';
import { cn } from 'cn';
import { Button } from '@/webview/components/ui/button';
import { Icon } from '@/webview/components/ui/icons';
import { fieldClassName } from '@/webview/components/ui/surface-styles';

export type AddressSegment = { name: string; location: string | null };

type AddressBreadcrumbProps = {
  segments: AddressSegment[];
  onNavigate: (location: string | null) => void;
  onEdit: () => void;
  suffix?: ReactNode;
};

export function AddressBreadcrumb({ segments, onNavigate, onEdit, suffix }: AddressBreadcrumbProps) {
  const currentIndex = segments.length - 1;
  return (
    <nav
      aria-label="Address"
      tabIndex={0}
      className={cn(fieldClassName, 'flex h-7 min-w-0 flex-1 cursor-text items-center')}
      onClick={onEdit}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onEdit();
        }
      }}
    >
      <div className="flex min-w-0 flex-1 items-center overflow-x-auto scrollbar-none [&::-webkit-scrollbar]:hidden">
        {segments.map((segment, index) => (
          <Fragment key={index}>
            {index > 0 && <Icon name="chevron-right" variant="muted" className="shrink-0" />}
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 whitespace-nowrap"
              aria-label={index === 0 ? 'System root' : undefined}
              aria-current={index === currentIndex ? 'page' : undefined}
              title={index === 0 ? 'System root' : segment.name}
              onClick={(event) => {
                event.stopPropagation();
                onNavigate(segment.location);
              }}
            >
              {index === 0 ? <Icon name="home" /> : <span className="text-sm">{segment.name}</span>}
            </Button>
          </Fragment>
        ))}
      </div>
      {suffix != null && <div className="flex shrink-0 items-center">{suffix}</div>}
    </nav>
  );
}
