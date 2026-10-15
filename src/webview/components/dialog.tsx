import { Dialog as BaseDialog } from '@base-ui/react/dialog';
import { cn } from 'cn';
import type { ReactNode } from 'react';
import { Button } from '@/webview/components/button';
import { Icon } from '@/webview/components/icons';
import { popupClassName } from '@/webview/components/surface-styles';

export type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  onSave?: () => void;
  form?: string;
  saveLabel?: string;
  saveDisabled?: boolean;
  pending?: boolean;
  className?: string;
};

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  onSave,
  form,
  saveLabel = 'Save',
  saveDisabled = false,
  pending = false,
  className,
}: DialogProps) {
  return (
    <BaseDialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!pending) onOpenChange(nextOpen);
      }}
      disablePointerDismissal
    >
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="fixed inset-0 z-40 bg-(--vscode-editor-background) opacity-60" />
        <BaseDialog.Popup
          className={cn(
            popupClassName,
            'fixed top-1/2 left-1/2 z-50 flex max-h-full w-160 max-w-full -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden p-3',
            className,
          )}
        >
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-(--vscode-panel-border) pb-3">
            <div className="min-w-0 flex-1">
              <BaseDialog.Title className="wrap-break-word font-semibold">{title}</BaseDialog.Title>
              {description != null && (
                <BaseDialog.Description className="mt-1 wrap-break-word text-(--vscode-descriptionForeground)">
                  {description}
                </BaseDialog.Description>
              )}
            </div>
            <BaseDialog.Close
              render={
                <Button
                  variant="ghost"
                  size="sm"
                  prefix={<Icon name="close" />}
                  aria-label="Close"
                  disabled={pending}
                />
              }
            />
          </div>
          <div className="-mx-3 min-h-0 overflow-auto px-3">{children}</div>
          <div className="mt-3 flex shrink-0 items-center justify-end gap-2 border-t border-(--vscode-panel-border) pt-3">
            {footer != null && <div className="mr-auto min-w-0">{footer}</div>}
            <BaseDialog.Close
              render={
                <Button variant="secondary" disabled={pending}>
                  Cancel
                </Button>
              }
            />
            <Button
              type={form ? 'submit' : 'button'}
              form={form}
              onClick={onSave}
              disabled={pending || saveDisabled || (!form && !onSave)}
              prefix={<Icon name={pending ? 'loading' : 'save'} className={pending ? 'animate-spin' : undefined} />}
            >
              {pending ? 'Saving...' : saveLabel}
            </Button>
          </div>
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}
