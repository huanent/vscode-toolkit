import type { ReactNode } from 'react';
import { Button } from '@/webview/components/ui/button';
import { Icon } from '@/webview/components/ui/icons';

type EditorSaveHeaderProps = {
  children: ReactNode;
  saving?: boolean;
  saveDisabled?: boolean;
};

export function EditorSaveHeader({ children, saving = false, saveDisabled }: EditorSaveHeaderProps) {
  return (
    <div className="sticky top-0 z-10 mt-5 flex w-full items-start gap-4 border-b border-(--vscode-panel-border) bg-(--vscode-editor-background)">
      <div className="flex min-w-0 flex-1 flex-wrap items-start gap-x-4">{children}</div>
      <div className="shrink-0">
        <Button
          shortcut="save"
          type="submit"
          prefix={<Icon name={saving ? 'loading' : 'save'} />}
          disabled={saveDisabled || saving}
        >
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  );
}
