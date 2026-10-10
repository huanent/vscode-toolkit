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
  footer?: ReactNode;
  className?: string;
  size?: 'md' | 'lg';
  closeDisabled?: boolean;
  closeOnBackdrop?: boolean;
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  size = 'md',
  closeDisabled = false,
  closeOnBackdrop = false,
}: DialogProps) {
  return (
    <BaseDialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen || !closeDisabled) onOpenChange(nextOpen);
      }}
      disablePointerDismissal={!closeOnBackdrop}
    >
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="fixed inset-0 z-40 bg-(--vscode-editor-background) opacity-60" />
        <BaseDialog.Popup
          className={cn(
            'fixed top-1/2 left-1/2 z-50 flex max-h-full -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-sm border border-(--vscode-widget-border,var(--vscode-panel-border)) bg-(--vscode-editorWidget-background,var(--vscode-editor-background)) p-3 text-(--vscode-editorWidget-foreground,var(--vscode-foreground)) shadow-sm focus:outline-none',
            size === 'lg' ? 'w-220 max-w-245' : 'w-160 max-w-180',
            className,
          )}
        >
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-(--vscode-panel-border) pb-3">
            <div className="min-w-0 flex-1">
              <BaseDialog.Title className="wrap-break-word text-sm font-semibold">{title}</BaseDialog.Title>
              {description && (
                <BaseDialog.Description className="mt-1 wrap-break-word text-xs text-(--vscode-descriptionForeground)">
                  {description}
                </BaseDialog.Description>
              )}
            </div>
            <BaseDialog.Close
              className="inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-sm text-(--vscode-descriptionForeground) hover:bg-(--vscode-toolbar-hoverBackground) hover:text-(--vscode-foreground)"
              aria-label="Close"
              disabled={closeDisabled}
            >
              <Icon name="close" size="md" />
            </BaseDialog.Close>
          </div>
          <div className="min-h-0 min-w-0 overflow-auto">{children}</div>
          {footer != null && (
            <div className="mt-3 flex shrink-0 items-center justify-end gap-2 border-t border-(--vscode-panel-border) pt-3">
              {footer}
            </div>
          )}
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}

export { BaseDialog };
