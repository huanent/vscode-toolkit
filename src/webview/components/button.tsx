import { Button as BaseButton } from '@base-ui/react/button';
import type { ButtonProps as BaseButtonProps } from '@base-ui/react/button';
import { cn } from 'cn';
import type { ReactNode } from 'react';

type ButtonProps = Omit<BaseButtonProps, 'className'> & {
  className?: string;
  icon?: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
};

const variantClasses = {
  primary:
    'bg-(--vscode-button-background) text-(--vscode-button-foreground) hover:bg-(--vscode-button-hoverBackground)',
  secondary:
    'border border-(--vscode-button-secondaryBackground) bg-(--vscode-button-secondaryBackground) text-(--vscode-button-secondaryForeground) hover:bg-(--vscode-button-secondaryHoverBackground)',
  ghost: 'bg-transparent text-(--vscode-foreground) hover:bg-(--vscode-toolbar-hoverBackground)',
} as const;

const sizeClasses = {
  sm: 'p-1 text-sm rounded-sm',
  md: 'p-2 text-md rounded-md',
  lg: 'p-3 text-lg rounded-lg',
} as const;

export function Button({
  className,
  icon,
  children,
  variant = 'primary',
  size = 'md',
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <BaseButton
      className={cn(
        'inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 border-0 transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        variantClasses[variant],
        sizeClasses[size],
        'leading-none',
        className,
      )}
      type={type}
      {...props}
    >
      {icon}
      {children}
    </BaseButton>
  );
}
