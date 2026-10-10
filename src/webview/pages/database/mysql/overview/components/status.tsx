import { cn } from 'cn';
import { Loading } from '@/webview/components/loading';

export function Status({
	children,
	loading,
	error,
}: {
	children: React.ReactNode;
	loading?: boolean;
	error?: boolean;
}) {
	if (loading) return <Loading label={children} />;
	return (
		<div
			className={cn(
				'flex items-center justify-center gap-2 p-8 text-center',
				error ? 'text-(--vscode-errorForeground)' : 'text-(--vscode-descriptionForeground)',
			)}
		>
			{children}
		</div>
	);
}
