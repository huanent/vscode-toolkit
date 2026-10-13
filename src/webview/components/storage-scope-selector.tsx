import type { StorageScope } from '@/shared/storage-scope';
import { SegmentedControl } from '@/webview/components/segmented-control';

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
