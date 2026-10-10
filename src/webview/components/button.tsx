import { Button as BaseButton, type ButtonProps as BaseButtonProps } from '@base-ui/react/button';
import { cn } from 'cn';
import type { ComponentPropsWithRef, ReactNode } from 'react';

export type ButtonSize = 'sm' | 'md' | 'lg';
export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'plain' | 'text';

const variantClasses: Record<ButtonVariant, string> = {
	primary:
		'border-(--vscode-button-border,transparent) bg-(--vscode-button-background) text-(--vscode-button-foreground) enabled:hover:bg-(--vscode-button-hoverBackground)',
	secondary:
		'border-(--vscode-button-border,transparent) bg-(--vscode-button-secondaryBackground) text-(--vscode-button-secondaryForeground) enabled:hover:bg-(--vscode-button-secondaryHoverBackground)',
	outline:
		'border-(--vscode-button-border,var(--vscode-contrastBorder,var(--vscode-widget-border,var(--vscode-foreground)))) bg-transparent text-(--vscode-foreground) enabled:hover:bg-(--vscode-toolbar-hoverBackground)',
	plain:
		'border-(--vscode-button-border,var(--vscode-contrastBorder,var(--vscode-widget-border,var(--vscode-foreground)))) bg-transparent text-(--vscode-foreground) enabled:hover:bg-(--vscode-toolbar-hoverBackground)',
	ghost:
		'border-transparent bg-transparent text-(--vscode-foreground) enabled:hover:bg-(--vscode-toolbar-hoverBackground)',
	text: 'border-transparent bg-transparent text-(--vscode-foreground) enabled:hover:bg-(--vscode-toolbar-hoverBackground)',
};

const activeClasses: Record<ButtonVariant, string> = {
	primary: 'bg-(--vscode-button-hoverBackground)',
	secondary: 'bg-(--vscode-button-secondaryHoverBackground)',
	outline: 'bg-(--vscode-toolbar-hoverBackground,var(--vscode-list-hoverBackground))',
	plain: 'bg-(--vscode-toolbar-hoverBackground,var(--vscode-list-hoverBackground))',
	ghost: 'bg-(--vscode-toolbar-hoverBackground,var(--vscode-list-hoverBackground))',
	text: 'bg-(--vscode-toolbar-hoverBackground,var(--vscode-list-hoverBackground))',
};

const sizes = {
	sm: { regular: 'h-6 min-w-6 px-2 text-xs', icon: 'size-6 p-0 text-xs' },
	md: { regular: 'h-7 min-w-7 px-3 text-xs', icon: 'size-7 p-0 text-xs' },
	lg: { regular: 'h-8 min-w-8 px-4 text-sm', icon: 'size-8 p-0 text-sm' },
} as const;

export type ButtonProps = Omit<BaseButtonProps, 'className' | 'prefix' | 'type'> & {
	className?: string;
	prefix?: ReactNode;
	suffix?: ReactNode;
	left?: ReactNode;
	right?: ReactNode;
	variant?: ButtonVariant;
	size?: ButtonSize;
	active?: boolean;
	htmlType?: ComponentPropsWithRef<'button'>['type'];
	type?: ComponentPropsWithRef<'button'>['type'];
};

export function Button({
	className,
	prefix,
	suffix,
	left,
	right,
	children,
	variant = 'primary',
	size = 'md',
	type = 'button',
	htmlType,
	active = false,
	...props
}: ButtonProps) {
	const effectivePrefix = prefix ?? left;
	const effectiveSuffix = suffix ?? right;
	const iconOnly = children == null && (effectivePrefix != null || effectiveSuffix != null);

	return (
		<BaseButton
			className={cn(
				'inline-flex shrink-0 cursor-pointer items-center justify-center gap-1 whitespace-nowrap rounded-sm border font-normal leading-none disabled:cursor-not-allowed disabled:opacity-50',
				variantClasses[variant],
				active && activeClasses[variant],
				sizes[size][iconOnly ? 'icon' : 'regular'],
				className,
			)}
			type={htmlType ?? type}
			{...props}
		>
			{effectivePrefix != null && (
				<span aria-hidden="true" className="inline-flex shrink-0 items-center justify-center">
					{effectivePrefix}
				</span>
			)}
			{children}
			{effectiveSuffix != null && (
				<span aria-hidden="true" className="inline-flex shrink-0 items-center justify-center">
					{effectiveSuffix}
				</span>
			)}
		</BaseButton>
	);
}

const iconButtonSizes = {
	sm: 'size-6',
	md: 'size-8',
	lg: 'size-10',
} as const;

export type IconButtonProps = Omit<
	ButtonProps,
	'children' | 'left' | 'right' | 'prefix' | 'suffix' | 'aria-label'
> & {
	icon: ReactNode;
	label: string;
};

export function IconButton({
	icon,
	label,
	size = 'md',
	variant = 'text',
	title = label,
	className,
	...props
}: IconButtonProps) {
	return (
		<Button
			{...props}
			size={size}
			variant={variant}
			title={title}
			aria-label={label}
			prefix={icon}
			className={cn(iconButtonSizes[size], 'shrink-0 gap-0 p-0', className)}
		/>
	);
}
