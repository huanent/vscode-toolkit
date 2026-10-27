import { useState } from 'react';
import type { ChatData } from '@/features/chat/protocol';
import { Button } from '@/webview/components/ui/button';
import { Icon } from '@/webview/components/ui/icons';
import { List } from '@/webview/components/ui/list';
import { Popover } from '@/webview/components/ui/popover';
import { TabPanel, Tabs } from '@/webview/components/ui/tabs';

interface ModelSelectorProps {
  models: ChatData['models'];
  value: string;
  disabled?: boolean;
  onValueChange: (value: string) => void;
}

export function ModelSelector({ models, value, disabled, onValueChange }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const [vendor, setVendor] = useState('');
  const selected = models.find((model) => model.value === value);
  const vendors = [...new Set(models.map((model) => model.vendor))].sort((first, second) => {
    if (first === second) return 0;
    if (first === 'copilot') return -1;
    if (second === 'copilot') return 1;
    return first.localeCompare(second);
  });
  const activeVendor = vendors.includes(vendor) ? vendor : (selected?.vendor ?? vendors[0] ?? '');

  function choose(model: ChatData['models'][number]): void {
    onValueChange(model.value);
    setOpen(false);
  }

  return (
    <Popover
      open={open && !disabled && models.length > 0}
      onOpenChange={(nextOpen) => {
        if (nextOpen) setVendor(selected?.vendor ?? vendors[0] ?? '');
        setOpen(nextOpen);
      }}
      side="top"
      sideOffset={6}
      className="w-max min-w-(--anchor-width) max-w-(--available-width) rounded-md text-xs p-1"
      trigger={
        <Button
          variant="ghost"
          disabled={disabled || !models.length}
          aria-label="Language model"
          title={selected ? `${selected.label} (${selected.vendor})` : 'No models available'}
          className="min-w-0 max-w-64 gap-1 px-1 text-xs text-(--vscode-descriptionForeground)"
          prefix={<Icon name="sparkle" size="sm" />}
        >
          <span className="min-w-0 truncate">{selected?.label ?? 'No models available'}</span>
        </Button>
      }
    >
      <Tabs
        tabs={vendors.map((id) => ({ id, label: id === 'copilot' ? 'Copilot' : id || 'Other' }))}
        activeTabId={activeVendor}
        onChange={setVendor}
        ariaLabel="Model providers"
        size="sm"
        className="min-h-0 max-h-(--available-height) text-xs p-1"
        contentClassName="min-h-0 pt-1 overflow-y-auto"
      >
        {vendors.map((id) => (
          <TabPanel key={id} tabId={id} className="h-32 max-h-40 overflow-y-auto">
            <List
              ariaLabel={`${id || 'Other'} models`}
              selectedKey={value}
              items={models
                .filter((model) => model.vendor === id)
                .sort((first, second) => first.label.localeCompare(second.label))
                .map((model) => ({
                  key: model.value,
                  data: model,
                  label: <span title={model.label}>{model.label}</span>,
                  icon: (
                    <div className="flex size-4 shrink-0 items-center justify-center">
                      {model.value === value && <Icon name="check" size="sm" />}
                    </div>
                  ),
                }))}
              onItemClick={choose}
              onActivate={choose}
            />
          </TabPanel>
        ))}
      </Tabs>
    </Popover>
  );
}
