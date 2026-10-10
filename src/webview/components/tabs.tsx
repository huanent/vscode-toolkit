import type { ReactNode } from 'react';
import { Tabs as BaseTabs } from '@base-ui/react/tabs';
import { cn } from 'cn';

export type Tab<T extends string = string> = {
	id: T;
	label: string;
	icon?: ReactNode;
};

type TabsProps<T extends string = string> = {
	tabs: readonly Tab<T>[];
	activeTabId: T;
	onChange: (tabId: T) => void;
	children: ReactNode;
	ariaLabel?: string;
	placement?: 'top' | 'bottom';
	hideSingleTab?: boolean;
	className?: string;
};

export function Tabs<T extends string = string>({
	tabs,
	activeTabId,
	onChange,
	children,
	ariaLabel = 'Sections',
	placement = 'top',
	hideSingleTab = false,
	className,
}: TabsProps<T>) {
	const bottom = placement === 'bottom';
	return (
		<BaseTabs.Root
			className={cn('flex min-w-0 flex-col', className)}
			value={activeTabId}
			onValueChange={value => {
				if (typeof value === 'string') onChange(value as T);
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
					aria-label={ariaLabel}
					className={cn('flex w-full overflow-x-auto', bottom && 'h-9 items-start px-2')}
				>
					{tabs.map(tab => {
						const isActive = activeTabId === tab.id;

						return (
							<BaseTabs.Tab
								key={tab.id}
								value={tab.id}
								className={cn(
									'relative inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap border-0 px-2 text-xs',
									bottom ? 'border-t-2' : 'flex-1 border-b-2',
									isActive
										? 'border-(--vscode-panelTitle-activeBorder,var(--vscode-focusBorder)) text-(--vscode-panelTitle-activeForeground,var(--vscode-foreground))'
										: 'border-transparent text-(--vscode-panelTitle-inactiveForeground,var(--vscode-descriptionForeground)) hover:text-(--vscode-foreground)',
								)}
							>
								{tab.icon}
								<span>{tab.label}</span>
							</BaseTabs.Tab>
						);
					})}
				</BaseTabs.List>
			</div>
			<div className="min-h-0 min-w-0 flex-1">{children}</div>
		</BaseTabs.Root>
	);
}

type TabPanelProps<T extends string = string> = {
	tabId: T;
	children: ReactNode;
	className?: string;
	keepMounted?: boolean;
};

export function TabPanel<T extends string = string>({
	tabId,
	children,
	className,
	keepMounted = true,
}: TabPanelProps<T>) {
	return (
		<BaseTabs.Panel
			value={tabId}
			keepMounted={keepMounted}
			className={cn('min-h-0 min-w-0 flex-1', className)}
		>
			{children}
		</BaseTabs.Panel>
	);
}
