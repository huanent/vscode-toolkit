import type { ReactNode } from 'react';
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
};

export function Tabs({ tabs, activeTabId, onChange }: TabsProps) {
  return (
    <div className="border-b border-(--vscode-panel-border)" role="tablist" aria-label="Dashboard sections">
      <div className="flex gap-1 overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = activeTabId === tab.id;

          return (
            <button
              className={cn(
                'relative inline-flex shrink-0 cursor-pointer items-center gap-2 border-0 border-b-2 px-4    py-1 text-sm transition-colors',
                isActive
                  ? 'border-(--vscode-focusBorder) text-(--vscode-foreground)'
                  : 'border-transparent text-(--vscode-descriptionForeground) hover:text-(--vscode-foreground)',
              )}
              id={`tab-${tab.id}`}
              key={tab.id}
              onClick={() => onChange(tab.id)}
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              type="button"
            >
              {tab.icon ? <span aria-hidden="true">{tab.icon}</span> : null}
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

type TabPanelProps = {
  tabId: string;
  activeTabId: string;
  children: ReactNode;
};

export function TabPanel({ tabId, activeTabId, children }: TabPanelProps) {
  const isActive = tabId === activeTabId;

  return (
    <div role="tabpanel" hidden={!isActive} tabIndex={0} aria-labelledby={`tab-${tabId}`}>
      {isActive ? children : null}
    </div>
  );
}
