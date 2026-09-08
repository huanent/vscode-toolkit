import { cn } from 'cn';
import type { ReactNode } from 'react';

export function FieldLabel({
	children,
	hint,
	action,
}: {
	children: ReactNode;
	hint?: ReactNode;
	action?: ReactNode;
}) {
	return (
		<span className="mb-2 flex min-h-6 items-center justify-between gap-2 text-xs font-semibold">
			<span>
				{children}
				{hint && (
					<small className="ml-1 font-normal text-(--vscode-descriptionForeground)">{hint}</small>
				)}
			</span>
			{action}
		</span>
	);
}

export function Field({
	label,
	required,
	hint,
	action,
	className = '',
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
			<FieldLabel hint={hint} action={action}>
				{label}
				{required && <span className="ml-1 text-(--vscode-errorForeground)">*</span>}
			</FieldLabel>
			{children}
		</label>
	);
}
