import { Fragment } from 'react';
import { cn } from 'cn';
import { Button } from '@/webview/components/button';
import { Icon } from '@/webview/components/icons';
import { fieldClassName } from '@/webview/components/surface-styles';
import type { AddressSegment } from '@/webview/pages/explorer/explorer-location';

type AddressBreadcrumbProps = {
  segments: AddressSegment[];
  onNavigate: (location: string) => void;
  onEdit: () => void;
};

export function AddressBreadcrumb({ segments, onNavigate, onEdit }: AddressBreadcrumbProps) {
  const currentIndex = segments.length - 1;

  return (
    <nav aria-label="Address" className={cn(fieldClassName, 'flex min-w-0 flex-1 items-center gap-1 overflow-x-auto')}>
      {segments.map((segment, index) => {
        const isCurrent = index === currentIndex;
        const location = isCurrent ? undefined : segment.location;
        return (
          <Fragment key={index}>
            {index > 0 && <Icon name="chevron-right" size="sm" variant="muted" className="shrink-0" />}
            {location === undefined ? (
              <span
                className={cn('shrink-0 whitespace-nowrap px-1', !isCurrent && 'text-(--vscode-descriptionForeground)')}
              >
                {segment.name}
              </span>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => onNavigate(location)}>
                {segment.name}
              </Button>
            )}
          </Fragment>
        );
      })}
      <Button variant="ghost" size="sm" aria-label="Edit address" className="flex-1" onClick={onEdit} />
    </nav>
  );
}
