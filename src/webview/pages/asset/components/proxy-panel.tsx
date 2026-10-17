import type { AssetEditorData } from '@/features/assets/protocol';
import { Button } from '@/webview/components/ui/button';
import { FormItem } from '@/webview/components/ui/form';
import { Icon } from '@/webview/components/ui/icons';
import { Select } from '@/webview/components/ui/select';

type ProxyPanelProps = {
  value?: string[];
  connections: AssetEditorData['sshConnections'];
  onChange: (value: string[]) => void;
};

export function ProxyPanel({ value = [], connections, onChange }: ProxyPanelProps) {
  const available = connections.filter((connection) => !value.includes(connection.id));
  const move = (index: number, offset: number) => {
    const next = [...value];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    onChange(next);
  };
  return (
    <div className="flex min-w-0 flex-col gap-3">
      {value.map((id, index) => (
        <FormItem key={index} name={`proxyAssetIds.${index}`} label={`Jump host ${index + 1}`} className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <div className="min-w-0 flex-1">
              <Select
                ariaLabel={`Jump host ${index + 1}`}
                value={id}
                onValueChange={(next) =>
                  onChange(value.map((current, position) => (position === index ? next : current)))
                }
                options={connections
                  .filter((connection) => connection.id === id || !value.includes(connection.id))
                  .map((connection) => ({
                    value: connection.id,
                    label: `${connection.name} (${connection.host}:${connection.port})`,
                  }))}
              />
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                title="Move up"
                aria-label="Move up"
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                <Icon name="arrow-up" />
              </Button>
              <Button
                variant="ghost"
                title="Move down"
                aria-label="Move down"
                disabled={index === value.length - 1}
                onClick={() => move(index, 1)}
              >
                <Icon name="arrow-down" />
              </Button>
              <Button
                variant="ghost"
                title="Remove jump host"
                aria-label="Remove jump host"
                onClick={() => onChange(value.filter((_, position) => position !== index))}
              >
                <Icon name="trash" />
              </Button>
            </div>
          </div>
        </FormItem>
      ))}
      <div>
        <Button
          variant="secondary"
          prefix={<Icon name="add" />}
          disabled={!available.length}
          onClick={() => {
            const connection = available[0];
            if (connection) onChange([...value, connection.id]);
          }}
        >
          Add jump host
        </Button>
      </div>
    </div>
  );
}
