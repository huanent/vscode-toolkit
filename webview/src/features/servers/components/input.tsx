import { cn } from 'cn';
import {
	useState,
	type InputHTMLAttributes,
	type SelectHTMLAttributes,
	type TextareaHTMLAttributes,
} from 'react';
import { Codicon } from './codicon';

export const inputClassName =
	'w-full rounded-[2px] border border-[var(--vscode-input-border,var(--vscode-widget-border,var(--vscode-panel-border)))] bg-(--vscode-input-background) text-(--vscode-input-foreground) outline-none focus:border-(--vscode-focusBorder) disabled:bg-(--vscode-input-background) disabled:text-(--vscode-disabledForeground,var(--vscode-descriptionForeground)) disabled:opacity-70';

export function TextInput({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
	return <input className={cn(inputClassName, 'h-8.5 px-2.5', className)} {...props} />;
}

export function PasswordInput({
	className = '',
	disabled,
	...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
	const [visible, setVisible] = useState(false);
	const visibilityLabel = visible ? 'Hide value' : 'Show value';

	return (
		<span className="relative block w-full">
			<TextInput
				className={cn('pr-9', className)}
				type={visible ? 'text' : 'password'}
				disabled={disabled}
				{...props}
			/>
			<button
				className="absolute inset-y-px right-px grid w-8 place-items-center rounded-r-[1px] border-0 bg-transparent p-0 text-(--vscode-icon-foreground) hover:bg-(--vscode-toolbar-hoverBackground) active:bg-(--vscode-toolbar-activeBackground,var(--vscode-toolbar-hoverBackground)) disabled:opacity-50"
				type="button"
				title={visibilityLabel}
				aria-label={visibilityLabel}
				aria-pressed={visible}
				disabled={disabled}
				onClick={() => setVisible(current => !current)}
			>
				<Codicon name={visible ? 'eye-closed' : 'eye'} />
			</button>
		</span>
	);
}

export function SelectInput({ className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
	return (
		<select
			className={cn(inputClassName, 'h-8.5 px-2.5 text-(--vscode-dropdown-foreground)', className)}
			{...props}
		/>
	);
}

export function TextArea({
	className = '',
	...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
	return (
		<textarea
			className={cn(
				inputClassName,
				'min-h-32 resize-y px-2.5 py-2 font-(family-name:--vscode-editor-font-family) text-xs leading-6',
				className,
			)}
			{...props}
		/>
	);
}
