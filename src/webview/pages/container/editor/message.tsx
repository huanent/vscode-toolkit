import { cn } from 'cn';

export function Message({
	children,
	error = false,
}: {
	children: React.ReactNode;
	error?: boolean;
}) {
	return (
		<div
			className={cn(
				'flex items-center justify-center gap-2 px-3 py-7 text-center',
				error ? 'text-(--vscode-errorForeground)' : 'text-(--vscode-descriptionForeground)',
			)}
		>
			{children}
		</div>
	);
}
