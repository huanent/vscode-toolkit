import type { StorageScope } from '@/shared/storage-scope';
import { Button } from '@/webview/components/ui/button';
import { FormItem } from '@/webview/components/ui/form';
import { Icon } from '@/webview/components/ui/icons';
import { Input } from '@/webview/components/ui/input';
import { SegmentedControl } from '@/webview/components/ui/segmented-control';

type StorageEditorHeaderProps = {
  name: string;
  onNameChange: (name: string) => void;
  namePlaceholder?: string;
  nameLabel?: string;
  nameRequired?: boolean;
  nameAutoFocus?: boolean;
  saving?: boolean;
  storageScope: StorageScope;
  onStorageScopeChange: (scope: StorageScope) => void;
  workspaceStorageAvailable: boolean;
  saveDisabled: boolean;
};

type StorageScopeSelectorProps = {
  value: StorageScope;
  workspaceAvailable: boolean;
  onValueChange: (value: StorageScope) => void;
};

export function StorageScopeSelector({ value, workspaceAvailable, onValueChange }: StorageScopeSelectorProps) {
  return (
    <div className="justify-self-start">
      <SegmentedControl
        ariaLabel="Storage location"
        value={value}
        onValueChange={onValueChange}
        options={[
          { value: 'global', label: 'Global' },
          { value: 'workspace', label: 'Workspace', disabled: !workspaceAvailable },
        ]}
      />
    </div>
  );
}

export function StorageEditorHeader({
  name,
  onNameChange,
  namePlaceholder,
  nameLabel = 'Name',
  nameRequired = false,
  nameAutoFocus = false,
  saving = false,
  storageScope,
  onStorageScopeChange,
  workspaceStorageAvailable,
  saveDisabled,
}: StorageEditorHeaderProps) {
  return (
    <div className="grid gap-4 border-b border-(--vscode-panel-border) px-4 py-4 md:grid-cols-2">
      <FormItem name="name" label={nameLabel} error={`${nameLabel} is required.`} match="valueMissing">
        <Input
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder={namePlaceholder}
          required={nameRequired}
          autoFocus={nameAutoFocus}
        />
      </FormItem>
      <div className="flex min-w-0 flex-wrap items-end gap-3">
        <FormItem name="storageScope" label="Storage location" className="min-w-0 flex-1">
          <StorageScopeSelector
            value={storageScope}
            workspaceAvailable={workspaceStorageAvailable}
            onValueChange={onStorageScopeChange}
          />
        </FormItem>
        <Button type="submit" prefix={<Icon name={saving ? 'loading' : 'save'} />} disabled={saveDisabled || saving}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  );
}
