import { type ReactNode } from 'react';
import { ChevronRight } from './icons';

export function ConnectionGroup({
	name,
	count,
	children,
	filtered = false,
}: {
	name: string;
	count: number;
	children: ReactNode;
	filtered?: boolean;
}) {
	if (!name) {
		return <ul className="m-0 grid list-none grid-cols-1 p-0">{children}</ul>;
	}
	return (
		<details className="group mb-1" aria-label={name} open={filtered || undefined}>
			<summary className="flex cursor-pointer list-none items-center gap-1 rounded-xs px-1 py-1 text-xs font-semibold hover:bg-(--vscode-list-hoverBackground) focus-visible:outline focus-visible:outline-(--vscode-focusBorder) [&::-webkit-details-marker]:hidden">
				<ChevronRight size={14} aria-hidden="true" className="shrink-0 group-open:rotate-90" />
				<span className="min-w-0 wrap-anywhere">{name}</span>
				<span className="ml-auto shrink-0 pl-2 font-normal text-(--vscode-descriptionForeground)">
					{count}
				</span>
			</summary>
			<ul
				aria-label={name}
				className="m-0 ml-2.5 grid list-none grid-cols-1 border-l border-(--vscode-tree-indentGuidesStroke) p-0 pl-2"
			>
				{children}
			</ul>
		</details>
	);
}
