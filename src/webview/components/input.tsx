import { Input as BaseInput } from '@base-ui/react/input';
import type { InputProps as BaseInputProps } from '@base-ui/react/input';
import { useState, type CSSProperties, type ComponentPropsWithRef, type ReactNode } from 'react';
import { cn } from 'cn';
import { IconButton } from './button';
import { Eye, EyeOff } from './icons';

const inputSizes = {
	sm: 'h-6 gap-1 px-2 text-xs',
	md: 'h-8 gap-2 px-2 text-sm',
	lg: 'h-10 gap-2 px-3 text-sm',
} as const;

export type InputSize = keyof typeof inputSizes;
export type InputVariant = 'default' | 'plain';

export type InputProps = Omit<BaseInputProps, 'prefix' | 'size'> & {
	size?: InputSize;
	variant?: InputVariant;
	prefix?: ReactNode;
	suffix?: ReactNode;
	left?: ReactNode;
	right?: ReactNode;
	containerClassName?: string;
	containerStyle?: CSSProperties;
	inputClassName?: string;
};

export function Input({
	className,
	size = 'md',
	variant = 'default',
	prefix,
	suffix,
	left,
	right,
	containerClassName,
	containerStyle,
	inputClassName,
	disabled,
	style,
	...props
}: InputProps) {
	const effectivePrefix = prefix ?? left;
	const effectiveSuffix = suffix ?? right;
	const hasSlots = effectivePrefix != null || effectiveSuffix != null;

	const input = (
		<BaseInput
			className={cn(
				'w-full min-w-0 border-0 bg-transparent text-inherit leading-normal outline-none placeholder:text-(--vscode-input-placeholderForeground) disabled:cursor-not-allowed disabled:opacity-50',
				inputSizes[size],
				hasSlots
					? 'flex-1 px-0 disabled:opacity-100'
					: 'rounded-sm border border-(--vscode-input-border,transparent) bg-(--vscode-input-background) px-2 focus:border-(--vscode-focusBorder)',
				inputClassName,
				className,
			)}
			disabled={disabled}
			style={hasSlots ? undefined : style}
			{...props}
		/>
	);

	if (!hasSlots) return input;

	return (
		<div
			className={cn(
				'flex w-full min-w-0 items-center text-(--vscode-input-foreground) transition-colors duration-100',
				variant === 'plain'
					? 'border-0 bg-transparent'
					: 'rounded-sm border border-(--vscode-input-border,transparent) bg-(--vscode-input-background) focus-within:border-(--vscode-focusBorder)',
				inputSizes[size],
				effectiveSuffix != null && '[&:has(>span:last-child>button)]:pr-0',
				disabled && 'cursor-not-allowed opacity-50',
				containerClassName,
			)}
			style={containerStyle}
		>
			{effectivePrefix != null && (
				<span className="inline-flex shrink-0 items-center">{effectivePrefix}</span>
			)}
			{input}
			{effectiveSuffix != null && (
				<span className="inline-flex shrink-0 items-center">{effectiveSuffix}</span>
			)}
		</div>
	);
}

export type PasswordInputProps = Omit<InputProps, 'type' | 'right' | 'suffix'>;

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

const controlClassName =
	'w-full min-w-0 rounded-sm border border-(--vscode-input-border,transparent) bg-(--vscode-input-background) text-sm text-(--vscode-input-foreground) outline-none focus:border-(--vscode-focusBorder) placeholder:text-(--vscode-input-placeholderForeground) disabled:cursor-not-allowed disabled:opacity-45 aria-invalid:border-(--vscode-inputValidation-errorBorder)';

export type TextareaProps = ComponentPropsWithRef<'textarea'>;

export function Textarea({ className, ...props }: TextareaProps) {
	return (
		<textarea
			className={cn(controlClassName, 'min-h-20 resize-y px-2 py-2', className)}
			{...props}
		/>
	);
}

export type SelectProps = Omit<ComponentPropsWithRef<'select'>, 'size'> & { size?: InputSize };

export function Select({ size = 'md', className, ...props }: SelectProps) {
	return <select className={cn(controlClassName, inputSizes[size], className)} {...props} />;
}
