import type { AssetEditorData } from '@/features/assets/protocol';
import { AssetSelect } from '@/webview/components/asset-select';
import { Button } from '@/webview/components/ui/button';
import { FormItem } from '@/webview/components/ui/form';
import { Icon } from '@/webview/components/ui/icons';

type ProxyPanelProps = {
  value?: string[];
  connections: AssetEditorData['assets'];
  onChange: (value: string[]) => void;
};

export function ProxyPanel({ value = [], connections, onChange }: ProxyPanelProps) {
  const available = connections.filter((connection) => connection.type === 'ssh' && !value.includes(connection.id));
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
              <AssetSelect
                ariaLabel={`Jump host ${index + 1}`}
                value={id}
                onValueChange={(next) =>
                  onChange(value.map((current, position) => (position === index ? next : current)))
                }
                assets={connections}
                filter={(connection) =>
                  connection.type === 'ssh' && (connection.id === id || !value.includes(connection.id))
                }
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
