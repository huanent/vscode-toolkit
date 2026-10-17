import type { StorageScope } from '@/shared/storage-scope';
import { Button } from '@/webview/components/ui/button';
import { FormItem } from '@/webview/components/ui/form';
import { Icon } from '@/webview/components/ui/icons';
import { SegmentedControl } from '@/webview/components/ui/segmented-control';

type StorageEditorHeaderProps = {
  saving?: boolean;
  storageScope: StorageScope;
  onStorageScopeChange: (scope: StorageScope) => void;
  workspaceStorageAvailable: boolean;
  saveDisabled: boolean;
};

export function StorageEditorHeader({
  saving = false,
  storageScope,
  onStorageScopeChange,
  workspaceStorageAvailable,
  saveDisabled,
}: StorageEditorHeaderProps) {
  return (
    <div className="sticky top-0 z-10 flex w-full flex-wrap items-center justify-between gap-3 border-b border-(--vscode-panel-border) bg-(--vscode-editor-background) p-2 mt-4">
      <FormItem name="storageScope" className="min-w-0">
        <div className="justify-self-start">
          <SegmentedControl
            ariaLabel="Storage location"
            value={storageScope}
            onValueChange={onStorageScopeChange}
            options={[
              { value: 'global', label: 'Global' },
              { value: 'workspace', label: 'Workspace', disabled: !workspaceStorageAvailable },
            ]}
          />
        </div>
      </FormItem>
      <Button type="submit" prefix={<Icon name={saving ? 'loading' : 'save'} />} disabled={saveDisabled || saving}>
        {saving ? 'Saving...' : 'Save'}
      </Button>
    </div>
  );
}
