import { cn } from 'cn';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { ChevronRight } from './icons';

type TreeProps = ComponentPropsWithoutRef<'details'> & {
	label: ReactNode;
	count?: number;
	summaryProps?: ComponentPropsWithoutRef<'summary'>;
};

export function Tree({ label, count, summaryProps, className, children, ...props }: TreeProps) {
	const { className: summaryClassName, ...summaryAttributes } = summaryProps ?? {};
	return (
		<details
			className={cn('min-w-0 [&[open]>summary>:first-child]:rotate-90', className)}
			{...props}
		>
			<summary
				className={cn(
					'flex cursor-pointer list-none items-center gap-1 rounded-xs px-1 text-sm font-semibold hover:bg-(--vscode-list-hoverBackground) [&::-webkit-details-marker]:hidden',
					summaryClassName,
				)}
				{...summaryAttributes}
			>
				<ChevronRight />
				<span className="min-w-0 flex-1 wrap-anywhere">{label}</span>
				{count !== undefined && <span className="p-1 text-xs font-normal text-(--vscode-descriptionForeground)">{count}</span>}
			</summary>
			<div className="ml-2.5 border-l border-(--vscode-tree-indentGuidesStroke) pl-2">
				{children}
			</div>
		</details>
	);
}