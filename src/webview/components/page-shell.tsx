import type { ReactNode } from 'react';

type PageShellProps = {
	children: ReactNode;
};

export function PageShell({ children }: PageShellProps) {
	return <main className="min-h-screen bg-(--vscode-sideBar-background)">{children}</main>;
}
