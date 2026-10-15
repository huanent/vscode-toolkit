import { Popover as BasePopover } from '@base-ui/react/popover';
import { cn } from 'cn';
import type { ReactElement, ReactNode } from 'react';
import { popupClassName } from '@/webview/components/ui/surface-styles';

export type PopoverProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger: ReactElement;
  children: ReactNode;
  className?: string;
  sideOffset?: number;
  align?: 'start' | 'center' | 'end';
};

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
      <BasePopover.Trigger render={trigger} />
      <BasePopover.Portal>
        <BasePopover.Positioner sideOffset={sideOffset} align={align} className="z-50">
          <BasePopover.Popup className={cn(popupClassName, 'overflow-hidden', className)}>{children}</BasePopover.Popup>
        </BasePopover.Positioner>
      </BasePopover.Portal>
    </BasePopover.Root>
  );
}
