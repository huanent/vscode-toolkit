import type { ReactNode } from 'react';
import { cn } from 'cn';

export function Field({
	label,
	required,
	hint,
	action,
	className,
	children,
}: {
	label: ReactNode;
	required?: boolean;
	hint?: ReactNode;
	action?: ReactNode;
	className?: string;
	children: ReactNode;
}) {
	return (
		<label className={cn('block min-w-0', className)}>
			<FieldLabel hint={hint}>
				<span>
					{label}
					{required && <span className="ml-1 text-(--vscode-errorForeground)">*</span>}
				</span>
				{action}
			</FieldLabel>
			{children}
		</label>
	);
}

export function FieldLabel({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
	return (
		<span className="mb-2 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1 text-sm font-medium">
			{children}
			{hint && (
				<small className="min-w-0 text-xs font-normal wrap-anywhere text-(--vscode-descriptionForeground)">{hint}</small>
			)}
		</span>
	);
}
