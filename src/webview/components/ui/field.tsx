import { cn } from 'cn';
import { useId, type ComponentPropsWithRef, type ReactNode } from 'react';

export function FieldLabel({ className, ...props }: ComponentPropsWithRef<'label'>) {
	return <label className={cn('text-sm font-medium text-(--vscode-foreground)', className)} {...props} />;
}

export type FieldControlProps = {
	id: string;
	required: boolean;
	'aria-describedby': string | undefined;
	'aria-invalid': true | undefined;
};

export type FieldProps = {
	id?: string;
	label: ReactNode;
	required?: boolean;
	description?: ReactNode;
	error?: ReactNode;
	action?: ReactNode;
	className?: string;
	children: (props: FieldControlProps) => ReactNode;
};

export function Field({ id, label, required = false, description, error, action, className, children }: FieldProps) {
	const generatedId = useId();
	const controlId = id ?? generatedId;
	const descriptionId = description ? `${controlId}-description` : undefined;
	const errorId = error ? `${controlId}-error` : undefined;
	return (
		<div className={cn('grid min-w-0 gap-1.5', className)}>
			<div className="flex min-w-0 items-center justify-between gap-2">
				<FieldLabel htmlFor={controlId}>
					{label}
					{required && <span aria-hidden="true" className="ml-1 text-(--vscode-errorForeground)">*</span>}
				</FieldLabel>
				{action}
			</div>
			{children({ id: controlId, required, 'aria-describedby': [descriptionId, errorId].filter(Boolean).join(' ') || undefined, 'aria-invalid': error ? true : undefined })}
			{description && <div id={descriptionId} className="text-xs wrap-anywhere text-(--vscode-descriptionForeground)">{description}</div>}
			{error && <div id={errorId} role="alert" className="text-xs wrap-anywhere text-(--vscode-errorForeground)">{error}</div>}
		</div>
	);
}