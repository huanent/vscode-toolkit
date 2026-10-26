import { Tabs as BaseTabs } from '@base-ui/react/tabs';
import { cn } from 'cn';
import type { ReactNode } from 'react';

export type Tab = {
  id: string;
  label: string;
  icon?: ReactNode;
  context?: Readonly<Record<string, string | number | boolean>>;
};

type TabsProps = {
  tabs: readonly Tab[];
  activeTabId: string;
  onChange: (tabId: string) => void;
  children: ReactNode;
  ariaLabel?: string;
  placement?: 'top' | 'bottom' | 'left';
  size?: 'sm' | 'md';
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
  size = 'md',
  hideSingleTab = false,
  className,
  contentClassName,
}: TabsProps) {
  const bottom = placement === 'bottom';
  const vertical = placement === 'left';
  return (
    <BaseTabs.Root
      className={cn('flex min-w-0', vertical ? 'flex-row' : 'flex-col', className)}
      orientation={vertical ? 'vertical' : 'horizontal'}
      value={activeTabId}
      onValueChange={(value) => {
        if (typeof value === 'string') onChange(value);
      }}
    >
      <div
        className={cn(
          vertical ? 'w-40 border-r' : bottom ? 'order-last border-t' : 'border-b',
          'shrink-0 border-(--vscode-panel-border)',
          hideSingleTab && tabs.length <= 1 && 'hidden',
        )}
      >
        <BaseTabs.List
          activateOnFocus={false}
          aria-label={ariaLabel}
          className={cn(
            'flex w-full',
            vertical ? 'flex-col' : 'overflow-x-auto',
            bottom && 'items-start',
            bottom && (size === 'sm' ? 'h-7 px-1' : 'h-9 px-2'),
          )}
        >
          {tabs.map((tab) => {
            const isActive = activeTabId === tab.id;

            return (
              <BaseTabs.Tab
                className={cn(
                  'relative inline-flex shrink-0 cursor-pointer items-center gap-1 whitespace-nowrap',
                  size === 'sm' ? 'h-6 px-2 text-xs' : 'h-8 px-3',
                  vertical
                    ? 'justify-end border-r-2 text-right'
                    : bottom
                      ? 'justify-center border-t-2'
                      : 'flex-1 justify-center border-b',
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
      <div className={cn('min-w-0', vertical && 'flex-1', contentClassName)}>{children}</div>
    </BaseTabs.Root>
  );
}

type TabPanelProps = {
  tabId: string;
  children: ReactNode;
  className?: string;
  keepMounted?: boolean;
};

export function TabPanel({ tabId, children, className, keepMounted = false }: TabPanelProps) {
  return (
    <BaseTabs.Panel value={tabId} keepMounted={keepMounted} className={cn('min-w-0', className)}>
      {children}
    </BaseTabs.Panel>
  );
}
