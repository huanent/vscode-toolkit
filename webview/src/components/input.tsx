import { cn } from 'cn';
import {
	useState,
	type InputHTMLAttributes,
	type SelectHTMLAttributes,
	type TextareaHTMLAttributes,
} from 'react';
import { Codicon } from './codicon';

export function SelectInput({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
	return <select className={cn(inputClassName, 'h-8 px-2.5 text-xs', className)} {...props} />;
}

export function PasswordInput({
	className,
	disabled,
	...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
	const [visible, setVisible] = useState(false);
	const label = visible ? 'Hide value' : 'Show value';
	return (
		<span className="relative block w-full">
			<TextInput
				{...props}
				disabled={disabled}
				type={visible ? 'text' : 'password'}
				className={cn('pr-9', className)}
			/>
			<button
				type="button"
				title={label}
				aria-label={label}
				aria-pressed={visible}
				disabled={disabled}
				onClick={() => setVisible(current => !current)}
				className="absolute inset-y-px right-px grid w-8 place-items-center rounded-md border-0 bg-transparent text-(--vscode-icon-foreground) hover:bg-(--vscode-toolbar-hoverBackground) disabled:opacity-50"
			>
				<Codicon name={visible ? 'eye-closed' : 'eye'} />
			</button>
		</span>
	);
}

export const inputClassName =
	'w-full rounded-md border border-(--vscode-input-border,transparent) bg-(--vscode-input-background) text-(--vscode-input-foreground) outline-none transition-[border-color,box-shadow] duration-100 hover:border-(--vscode-inputOption-hoverBackground,var(--vscode-widget-border)) focus:border-(--vscode-focusBorder) focus:shadow-[0_0_0_1px_var(--vscode-focusBorder)]';

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
