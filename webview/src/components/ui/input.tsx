import { cn } from 'cn';
import { useState, type ComponentPropsWithRef, type ReactNode } from 'react';
import { IconButton } from './button';
import { Eye, EyeOff } from './icons';

const inputSizes = {
	sm: 'h-6 gap-1 px-2 text-xs',
	md: 'h-8 gap-2 px-2 text-sm',
	lg: 'h-10 gap-2 px-3 text-sm',
} as const;

export type InputSize = keyof typeof inputSizes;
export type InputVariant = 'default' | 'plain';

export type InputProps = Omit<ComponentPropsWithRef<'input'>, 'size' | 'children'> & {
	size?: InputSize;
	variant?: InputVariant;
	left?: ReactNode;
	right?: ReactNode;
	inputClassName?: string;
};

export function Input({
	size = 'md',
	variant = 'default',
	left,
	right,
	className,
	inputClassName,
	disabled,
	style,
	...props
}: InputProps) {
	return (
		<div
			className={cn(
				'flex w-full min-w-0 items-center text-(--vscode-input-foreground) transition-colors duration-100',
				variant === 'plain'
					? 'border-0 bg-transparent'
					: 'border border-(--vscode-input-border,transparent) bg-(--vscode-input-background) focus-within:border-(--vscode-focusBorder)',
				inputSizes[size],
				right != null && '[&:has(>span:last-child>button)]:pr-0',
				disabled && 'cursor-default opacity-45',
				className,
			)}
			style={{ borderRadius: 4, ...style }}
		>
			{left != null && (
				<span className="inline-flex h-full shrink-0 items-center justify-center leading-none text-(--vscode-descriptionForeground) [&_.codicon]:block [&_.codicon]:leading-none">{left}</span>
			)}
			<input
				className={cn(
					'h-full w-full min-w-0 flex-1 appearance-none border-0 bg-transparent p-0 text-inherit leading-normal outline-none placeholder:text-(--vscode-input-placeholderForeground) disabled:cursor-default [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden',
					'aria-invalid:outline-1 aria-invalid:outline-(--vscode-inputValidation-errorBorder)',
					inputClassName,
				)}
				disabled={disabled}
				{...props}
			/>
			{right != null && (
				<span className="inline-flex h-full shrink-0 items-center justify-center leading-none text-(--vscode-descriptionForeground) [&:has(>button)]:aspect-square [&_.codicon]:block [&_.codicon]:leading-none">{right}</span>
			)}
		</div>
	);
}

export type PasswordInputProps = Omit<InputProps, 'type' | 'right'>;

export function PasswordInput({ disabled, ...props }: PasswordInputProps) {
	const [visible, setVisible] = useState(false);
	return (
		<Input
			{...props}
			disabled={disabled}
			type={visible ? 'text' : 'password'}
			right={
				<IconButton
					size="sm"
					icon={visible ? <EyeOff /> : <Eye />}
					label={visible ? 'Hide password' : 'Show password'}
					aria-pressed={visible}
					disabled={disabled}
					onClick={() => setVisible(current => !current)}
				/>
			}
		/>
	);
}

const controlClassName = 'w-full min-w-0 border border-(--vscode-input-border,transparent) bg-(--vscode-input-background) text-sm text-(--vscode-input-foreground) outline-none focus:border-(--vscode-focusBorder) placeholder:text-(--vscode-input-placeholderForeground) disabled:cursor-default disabled:opacity-45 aria-invalid:border-(--vscode-inputValidation-errorBorder)';

export type TextareaProps = ComponentPropsWithRef<'textarea'>;

export function Textarea({ className, style, ...props }: TextareaProps) {
	return <textarea className={cn(controlClassName, 'min-h-20 resize-y px-2 py-2', className)} style={{ borderRadius: 4, ...style }} {...props} />;
}

export type SelectProps = Omit<ComponentPropsWithRef<'select'>, 'size'> & { size?: InputSize };

export function Select({ size = 'md', className, style, ...props }: SelectProps) {
	return <select className={cn(controlClassName, inputSizes[size], className)} style={{ borderRadius: 4, ...style }} {...props} />;
}