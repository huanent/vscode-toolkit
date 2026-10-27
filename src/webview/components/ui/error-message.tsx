import { Dialog } from '@base-ui/react/dialog';
import { cn } from 'cn';
import { Button } from '@/webview/components/ui/button';
import { Icon } from '@/webview/components/ui/icons';
import { glassBackdropClassName, glassPopupClassName, popupClassName } from '@/webview/components/ui/surface-styles';

type ErrorMessageProps = {
  message: string;
};

export function ErrorMessage({ message }: ErrorMessageProps) {
  if (!message) return null;

  return (
    // Keying by message remounts the dialog, so a dismissed error reopens when a different message arrives.
    <Dialog.Root key={message} defaultOpen disablePointerDismissal>
      <Dialog.Portal>
        <Dialog.Backdrop className={cn('fixed inset-0 z-50', glassBackdropClassName)} />
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
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
