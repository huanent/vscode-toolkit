import { cn } from 'cn';
import type { ComponentPropsWithRef, ReactNode } from 'react';

const buttonSizes = {
	sm: 'min-h-6 gap-1 px-2 py-0.5 text-xs',
	md: 'min-h-8 gap-2 px-3 py-1 text-sm',
	lg: 'min-h-10 gap-2 px-4 py-2 text-sm',
} as const;

const buttonVariants = {
	primary:
		'border-(--vscode-button-border,transparent) bg-(--vscode-button-background) text-(--vscode-button-foreground) enabled:hover:bg-(--vscode-button-hoverBackground) enabled:active:brightness-95',
	plain:
		'border-(--vscode-button-border,var(--vscode-contrastBorder,var(--vscode-panel-border))) bg-transparent text-(--vscode-foreground) enabled:hover:bg-(--vscode-toolbar-hoverBackground)',
	text:
		'border-transparent bg-transparent text-(--vscode-foreground) enabled:hover:bg-(--vscode-toolbar-hoverBackground)',
} as const;

const activeVariants = {
	primary: 'bg-(--vscode-button-hoverBackground)',
	plain: 'bg-(--vscode-toolbar-hoverBackground,var(--vscode-list-hoverBackground))',
	text: 'bg-(--vscode-toolbar-hoverBackground,var(--vscode-list-hoverBackground))',
} as const;

export type ButtonSize = keyof typeof buttonSizes;
export type ButtonVariant = keyof typeof buttonVariants;

export type ButtonProps = Omit<ComponentPropsWithRef<'button'>, 'type'> & {
	size?: ButtonSize;
	variant?: ButtonVariant;
	active?: boolean;
	htmlType?: ComponentPropsWithRef<'button'>['type'];
	left?: ReactNode;
	right?: ReactNode;
};

export function Button({
	size = 'md',
	variant = 'primary',
	active = false,
	htmlType = 'button',
	left,
	right,
	children,
	className,
	...props
}: ButtonProps) {
	return (
		<button
			type={htmlType}
			className={cn(
				'inline-flex max-w-full items-center justify-center rounded-sm border font-medium transition-colors duration-100 focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-(--vscode-focusBorder) disabled:cursor-default disabled:opacity-45',
				buttonSizes[size],
				buttonVariants[variant],
				active && activeVariants[variant],
				className,
			)}
			{...props}
		>
			{left != null && <span className="inline-flex shrink-0 items-center">{left}</span>}
			{children != null && <span className="min-w-0 wrap-anywhere">{children}</span>}
			{right != null && <span className="inline-flex shrink-0 items-center">{right}</span>}
		</button>
	);
}

const iconButtonSizes = {
	sm: 'size-6',
	md: 'size-8',
	lg: 'size-10',
} as const;

export type IconButtonProps = Omit<ButtonProps, 'children' | 'left' | 'right' | 'aria-label'> & {
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
			left={icon}
			className={cn(iconButtonSizes[size], 'shrink-0 gap-0 p-0', className)}
		/>
	);
}