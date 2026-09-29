import type { ReactNode } from 'react';
import { Tabs as BaseTabs } from '@base-ui/react/tabs';
import { cn } from 'cn';

export type Tab = {
  id: string;
  label: string;
  icon?: ReactNode;
};

type TabsProps = {
  tabs: Tab[];
  activeTabId: string;
  onChange: (tabId: string) => void;
  children: ReactNode;
};

export function Tabs({ tabs, activeTabId, onChange, children }: TabsProps) {
  return (
    <BaseTabs.Root
      value={activeTabId}
      onValueChange={(value) => {
        if (typeof value === 'string') onChange(value);
      }}
    >
      <div className="border-b border-(--vscode-panel-border)">
        <BaseTabs.List activateOnFocus={false} aria-label="Dashboard sections" className="flex w-full overflow-x-auto">
          {tabs.map((tab) => {
            const isActive = activeTabId === tab.id;

            return (
              <BaseTabs.Tab
                className={cn(
                  'relative inline-flex h-10 min-w-0 flex-1 cursor-pointer items-center justify-center gap-1 border-0 border-b-2 px-3 text-sm transition-colors',
                  isActive
                    ? 'border-(--vscode-focusBorder) text-(--vscode-foreground)'
                    : 'border-transparent text-(--vscode-descriptionForeground) hover:text-(--vscode-foreground)',
                )}
                key={tab.id}
                value={tab.id}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </BaseTabs.Tab>
            );
          })}
        </BaseTabs.List>
      </div>
      {children}
    </BaseTabs.Root>
  );
}

type TabPanelProps = {
  tabId: string;
  children: ReactNode;
};

export function TabPanel({ tabId, children }: TabPanelProps) {
  return <BaseTabs.Panel value={tabId}>{children}</BaseTabs.Panel>;
}
