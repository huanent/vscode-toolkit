import { cn } from 'cn';
import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

export const inputClassName =
	'w-full rounded-[2px] border border-(--vscode-input-border,transparent) bg-(--vscode-input-background) text-(--vscode-input-foreground) outline-none transition-[border-color,box-shadow] duration-100 hover:border-(--vscode-inputOption-hoverBackground,var(--vscode-widget-border)) focus:border-(--vscode-focusBorder) focus:shadow-[0_0_0_1px_var(--vscode-focusBorder)]';

export function TextInput({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
	return <input className={cn(inputClassName, 'h-8 px-2.5 text-xs', className)} {...props} />;
}

export function TextArea({
	className = '',
	...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
	return (
		<textarea
			className={cn(
				inputClassName,
				'min-h-20 resize-y px-2.5 py-2 font-(--vscode-editor-font-family) text-xs leading-5',
				className,
			)}
			{...props}
		/>
	);
}
