import { Dialog as BaseDialog } from '@base-ui/react/dialog';
import { cn } from 'cn';
import type { ReactNode } from 'react';
import { Icon } from './icons';

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Dialog({ open, onOpenChange, title, description, children, className }: DialogProps) {
  return (
    <BaseDialog.Root open={open} onOpenChange={onOpenChange}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="fixed inset-0 z-40 bg-black opacity-50" />
        <BaseDialog.Popup
          className={cn(
            'fixed top-1/2 left-1/2 z-50 flex max-h-160 w-160 max-w-full -translate-x-1/2 -translate-y-1/2 flex-col rounded-md border border-(--vscode-widget-border) bg-(--vscode-editor-background) p-4 text-(--vscode-foreground) shadow-lg focus:outline-none',
            className,
          )}
        >
          <div className="flex shrink-0 items-center justify-between pb-3">
            <div>
              <BaseDialog.Title className="text-sm font-semibold text-(--vscode-foreground)">{title}</BaseDialog.Title>
              {description && (
                <BaseDialog.Description className="mt-1 text-xs text-(--vscode-descriptionForeground)">
                  {description}
                </BaseDialog.Description>
              )}
            </div>
            <BaseDialog.Close
              className="inline-flex size-6 cursor-pointer items-center justify-center rounded text-(--vscode-descriptionForeground) hover:bg-(--vscode-toolbar-hoverBackground) hover:text-(--vscode-foreground) focus-visible:outline-1 focus-visible:outline-(--vscode-focusBorder)"
              aria-label="Close"
            >
              <Icon name="close" size="md" />
            </BaseDialog.Close>
          </div>
          {children}
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}

export { BaseDialog };
