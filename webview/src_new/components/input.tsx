import { cn } from 'cn';
import type { ComponentPropsWithRef, ReactNode } from 'react';

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
				'flex w-full min-w-0 items-center rounded-sm text-(--vscode-input-foreground) transition-colors duration-100',
				variant === 'plain'
					? 'border-0 bg-transparent'
					: 'border border-(--vscode-input-border,transparent) bg-(--vscode-input-background) focus-within:border-(--vscode-focusBorder)',
				inputSizes[size],
				disabled && 'cursor-default opacity-45',
				className,
			)}
			style={style}
		>
			{left != null && (
				<span className="inline-flex h-full shrink-0 items-center justify-center leading-none text-(--vscode-descriptionForeground) [&_.codicon]:block [&_.codicon]:leading-none">{left}</span>
			)}
			<input
				className={cn(
					'h-full w-full min-w-0 flex-1 appearance-none border-0 bg-transparent p-0 text-inherit leading-normal outline-none placeholder:text-(--vscode-input-placeholderForeground) disabled:cursor-default [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden',
					inputClassName,
				)}
				disabled={disabled}
				{...props}
			/>
			{right != null && (
				<span className="inline-flex h-full shrink-0 items-center justify-center leading-none text-(--vscode-descriptionForeground) [&_.codicon]:block [&_.codicon]:leading-none">{right}</span>
			)}
		</div>
	);
}