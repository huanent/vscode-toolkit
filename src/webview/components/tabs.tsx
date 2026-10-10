import type { ReactNode } from 'react';
import { Tabs as BaseTabs } from '@base-ui/react/tabs';
import { cn } from 'cn';

export type Tab = {
  id: string;
  label: string;
  icon?: ReactNode;
  context?: Record<string, string | boolean>;
};

type TabsProps = {
  tabs: Tab[];
  activeTabId: string;
  onChange: (tabId: string) => void;
  children: ReactNode;
  ariaLabel?: string;
  placement?: 'top' | 'bottom';
  hideSingleTab?: boolean;
  className?: string;
  contentClassName?: string;
};

export function Tabs({
  tabs,
  activeTabId,
  onChange,
  children,
  ariaLabel = 'Sections',
  placement = 'top',
  hideSingleTab = false,
  className,
  contentClassName,
}: TabsProps) {
  const bottom = placement === 'bottom';
  return (
    <BaseTabs.Root
      className={cn('flex min-w-0 flex-col', className)}
      value={activeTabId}
      onValueChange={(value) => {
        if (typeof value === 'string') onChange(value);
      }}
    >
      <div
        className={cn(
          bottom ? 'order-last border-t' : 'border-b',
          'shrink-0 border-(--vscode-panel-border)',
          hideSingleTab && tabs.length <= 1 && 'hidden',
        )}
      >
        <BaseTabs.List
          activateOnFocus={false}
          aria-label={ariaLabel}
          className={cn('flex w-full overflow-x-auto', bottom && 'h-9 items-start px-2')}
        >
          {tabs.map((tab) => {
            const isActive = activeTabId === tab.id;

            return (
              <BaseTabs.Tab
                className={cn(
                  'relative inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1 whitespace-nowrap border-0 px-3 text-sm',
                  bottom ? 'border-t-2' : 'flex-1 border-b',
                  isActive
                    ? 'border-(--vscode-panelTitle-activeBorder,var(--vscode-focusBorder)) text-(--vscode-panelTitle-activeForeground,var(--vscode-foreground))'
                    : 'border-transparent text-(--vscode-panelTitle-inactiveForeground,var(--vscode-descriptionForeground)) hover:text-(--vscode-foreground)',
                )}
                key={tab.id}
                data-vscode-context={tab.context ? JSON.stringify(tab.context) : undefined}
                value={tab.id}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </BaseTabs.Tab>
            );
          })}
        </BaseTabs.List>
      </div>
      <div className={cn('min-w-0', contentClassName)}>{children}</div>
    </BaseTabs.Root>
  );
}

type TabPanelProps = {
  tabId: string;
  children: ReactNode;
  className?: string;
};

export function TabPanel({ tabId, children, className }: TabPanelProps) {
  return (
    <BaseTabs.Panel value={tabId} className={cn('min-w-0', className)}>
      {children}
    </BaseTabs.Panel>
  );
}
