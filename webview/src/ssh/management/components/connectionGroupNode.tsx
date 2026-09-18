import type { ReactNode } from 'react';
import { Tree } from '@webview/components/ui/tree';

export function ConnectionGroupNode({
	name,
	count,
	filtered,
	first,
	last,
	children,
}: {
	name: string;
	count: number;
	filtered: boolean;
	first: boolean;
	last: boolean;
	children: ReactNode;
}) {
	return (
		<Tree
			label={name}
			count={count}
			open={filtered || undefined}
			summaryProps={{
				'data-vscode-context': JSON.stringify({
					webviewSection: 'sshGroup',
					dashboardTab: 'ssh',
					connectionId: name,
					dashboardFiltered: filtered,
					dashboardGroupFirst: first,
					dashboardGroupLast: last,
					preventDefaultContextMenuItems: true,
				}),
			}}
		>
			{children}
		</Tree>
	);
}