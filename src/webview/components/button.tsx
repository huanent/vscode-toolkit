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
    'border-(--vscode-button-border,transparent) bg-(--vscode-button-background) text-(--vscode-button-foreground) enabled:hover:bg-(--vscode-button-hoverBackground)',
  secondary:
    'border-(--vscode-button-border,transparent) bg-(--vscode-button-secondaryBackground) text-(--vscode-button-secondaryForeground) enabled:hover:bg-(--vscode-button-secondaryHoverBackground)',
  ghost:
    'border-transparent bg-transparent text-(--vscode-foreground) enabled:hover:bg-(--vscode-toolbar-hoverBackground)',
} as const;

const sizeClasses = {
  sm: 'h-6 min-w-6 px-1 text-xs',
  md: 'h-7 min-w-7 px-2 text-xs',
  lg: 'h-8 min-w-8 px-3 text-sm',
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
        'inline-flex shrink-0 cursor-pointer items-center justify-center gap-1 rounded-sm border font-normal disabled:cursor-not-allowed disabled:opacity-50',
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
