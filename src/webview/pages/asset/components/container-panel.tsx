import { AssetSelect } from '@/webview/components/asset-select';
import { Button } from '@/webview/components/ui/button';
import { FormItem } from '@/webview/components/ui/form';
import { Input } from '@/webview/components/ui/input';
import { Select } from '@/webview/components/ui/select';
import type { ConnectionPanelProps } from '@/webview/pages/asset/components/connection-panel';

export function ContainerPanel({ values, assets, onChange }: ConnectionPanelProps) {
  const value = values.container;
  if (!value) return null;
  return (
    <>
      <FormItem name="runtime" label="Container runtime">
        <Select
          ariaLabel="Container runtime"
          value={value.runtime}
          onValueChange={(runtime) => onChange({ container: { ...value, runtime: runtime as typeof value.runtime } })}
          options={[
            { value: 'apple', label: 'Apple Container' },
            { value: 'docker', label: 'Docker' },
            { value: 'podman', label: 'Podman' },
          ]}
        />
      </FormItem>
      <FormItem name="cliPath" label="CLI path (optional)">
        <Input
          value={value.cliPath ?? ''}
          onChange={(event) => onChange({ container: { ...value, cliPath: event.target.value || undefined } })}
          placeholder="Use executable from PATH"
        />
      </FormItem>
      <FormItem name="sshAssetId" label="SSH asset (optional)">
        <div className="flex min-w-0 gap-2">
          <div className="min-w-0 flex-1">
            <AssetSelect
              ariaLabel="SSH asset"
              placeholder="Local machine"
              assets={assets}
              filter={(asset) => asset.type === 'ssh'}
              value={value.sshAssetId}
              onValueChange={(sshAssetId) => onChange({ container: { ...value, sshAssetId } })}
            />
          </div>
          {value.sshAssetId && (
            <Button variant="secondary" onClick={() => onChange({ container: { ...value, sshAssetId: undefined } })}>
              Clear
            </Button>
          )}
        </div>
      </FormItem>
    </>
  );
}
