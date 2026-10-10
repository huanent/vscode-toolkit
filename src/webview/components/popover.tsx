import { Popover as BasePopover } from '@base-ui/react/popover';
import { cn } from 'cn';
import type { ReactNode } from 'react';

export interface PopoverProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger: ReactNode;
  children: ReactNode;
  className?: string;
  sideOffset?: number;
  align?: 'start' | 'center' | 'end';
}

export function Popover({
  open,
  onOpenChange,
  trigger,
  children,
  className,
  sideOffset = 4,
  align = 'start',
}: PopoverProps) {
  return (
    <BasePopover.Root open={open} onOpenChange={onOpenChange}>
      <BasePopover.Trigger render={trigger as React.ReactElement} />
      <BasePopover.Portal>
        <BasePopover.Positioner sideOffset={sideOffset} align={align} className="z-50">
          <BasePopover.Popup
            className={cn(
              'overflow-hidden rounded-sm border border-(--vscode-widget-border,var(--vscode-panel-border)) bg-(--vscode-editorWidget-background,var(--vscode-editor-background)) text-xs text-(--vscode-foreground) shadow-md focus:outline-none',
              className,
            )}
          >
            {children}
          </BasePopover.Popup>
        </BasePopover.Positioner>
      </BasePopover.Portal>
    </BasePopover.Root>
  );
}

export { BasePopover };
