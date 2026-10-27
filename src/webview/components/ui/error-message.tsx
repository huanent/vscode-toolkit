import { Dialog } from '@base-ui/react/dialog';
import { cn } from 'cn';
import { useState } from 'react';
import { Button } from '@/webview/components/ui/button';
import { Icon } from '@/webview/components/ui/icons';
import { glassPopupClassName, popupClassName } from '@/webview/components/ui/surface-styles';

type ErrorMessageProps = {
  message: string;
  className?: string;
};

export function ErrorMessage({ message }: ErrorMessageProps) {
  const [dismissedMessage, setDismissedMessage] = useState<string>();

  return (
    <Dialog.Root
      open={dismissedMessage !== message}
      onOpenChange={(open) => {
        if (!open) setDismissedMessage(message);
      }}
      disablePointerDismissal
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-(--vscode-editor-background) opacity-60" />
        <Dialog.Popup
          className={cn(
            popupClassName,
            glassPopupClassName,
            'fixed top-1/2 left-1/2 z-50 flex max-h-full w-120 max-w-full -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden p-4',
          )}
        >
          <div className="flex shrink-0 items-center justify-between gap-3">
            <Dialog.Title className="flex min-w-0 items-center gap-2 font-semibold">
              <Icon name="error" className="text-(--vscode-errorForeground)" />
              Error
            </Dialog.Title>
            <Dialog.Close
              render={<Button variant="ghost" prefix={<Icon name="close" />} aria-label="Close error" title="Close" />}
            />
          </div>
          <Dialog.Description className="my-4 min-h-0 overflow-auto whitespace-pre-wrap wrap-anywhere">
            {message}
          </Dialog.Description>
          <div className="flex shrink-0 justify-end">
            <Dialog.Close render={<Button>Close</Button>} />
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
