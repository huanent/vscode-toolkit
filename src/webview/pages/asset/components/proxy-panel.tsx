import type { AssetEditorData } from '@/features/assets/protocol';
import { FormItem } from '@/webview/components/ui/form';
import { Select } from '@/webview/components/ui/select';

type ProxyPanelProps = {
  value?: string;
  connections: AssetEditorData['sshConnections'];
  onChange: (value: string | undefined) => void;
};

export function ProxyPanel({ value, connections, onChange }: ProxyPanelProps) {
  return (
    <FormItem name="proxyAssetId" label="Proxy tunnel (optional)" className="min-w-0">
      <Select
        ariaLabel="Proxy tunnel"
        value={value ?? ''}
        onValueChange={(next) => onChange(next || undefined)}
        options={[
          { value: '', label: 'Direct connection' },
          ...connections.map((connection) => ({
            value: connection.id,
            label: `${connection.name} (${connection.host}:${connection.port})`,
          })),
        ]}
      />
    </FormItem>
  );
}
