import type { ReactNode } from 'react';
import { cn } from 'cn';

export const buttonClass =
	'inline-flex h-8 shrink-0 items-center justify-center gap-2 rounded-xs px-2 text-xs hover:bg-(--vscode-toolbar-hoverBackground) focus-visible:outline focus-visible:outline-(--vscode-focusBorder) disabled:opacity-40';
export function IconButton({
	title,
	children,
	onClick,
	disabled,
}: {
	title: string;
	children: ReactNode;
	onClick: () => void;
	disabled?: boolean;
}) {
	return (
		<button
			type="button"
			className={cn(buttonClass, 'w-8')}
			title={title}
			aria-label={title}
			onClick={onClick}
			disabled={disabled}
		>
			{children}
		</button>
	);
}
export function Field({ label, children }: { label: string; children: ReactNode }) {
	return (
		<label className="flex min-w-0 flex-col gap-1.5 text-xs text-(--vscode-descriptionForeground)">
			<span>{label}</span>
			{children}
		</label>
	);
}
