import { cn } from 'cn';
import { Button as SourceButton } from '@/webview/components/button';
import type { ComponentPropsWithRef, ReactNode } from 'react';

const buttonVariants = {
	primary: 'primary',
	plain: 'outline',
	text: 'ghost',
} as const;

const activeVariants = {
	primary: 'bg-(--vscode-button-hoverBackground)',
	plain: 'bg-(--vscode-toolbar-hoverBackground,var(--vscode-list-hoverBackground))',
	text: 'bg-(--vscode-toolbar-hoverBackground,var(--vscode-list-hoverBackground))',
} as const;

export type ButtonSize = 'sm' | 'md' | 'lg';
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
		<SourceButton
			{...props}
			type={htmlType}
			size={size}
			variant={buttonVariants[variant]}
			prefix={left}
			suffix={right}
			className={cn(active && activeVariants[variant], className)}
		>
			{children}
		</SourceButton>
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