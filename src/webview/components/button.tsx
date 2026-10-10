import { Button as BaseButton, type ButtonProps as BaseButtonProps } from '@base-ui/react/button';
import { cn } from 'cn';
import type { ReactNode } from 'react';

export type ButtonProps = Omit<BaseButtonProps, 'className' | 'prefix'> & {
  className?: string;
  prefix?: ReactNode;
  suffix?: ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
};

const variants = {
  primary:
    'border-(--vscode-button-border,transparent) bg-(--vscode-button-background) text-(--vscode-button-foreground) enabled:hover:bg-(--vscode-button-hoverBackground)',
  secondary:
    'border-(--vscode-button-border,transparent) bg-(--vscode-button-secondaryBackground) text-(--vscode-button-secondaryForeground) enabled:hover:bg-(--vscode-button-secondaryHoverBackground)',
  outline:
    'border-(--vscode-button-border,var(--vscode-contrastBorder,var(--vscode-widget-border,var(--vscode-foreground)))) bg-transparent text-(--vscode-foreground) enabled:hover:bg-(--vscode-toolbar-hoverBackground)',
  ghost:
    'border-transparent bg-transparent text-(--vscode-foreground) enabled:hover:bg-(--vscode-toolbar-hoverBackground)',
} as const;

const sizes = {
  sm: { regular: 'h-6 min-w-6 px-2 text-xs', icon: 'size-6 p-0 text-xs' },
  md: { regular: 'h-7 min-w-7 px-3 text-xs', icon: 'size-7 p-0 text-xs' },
  lg: { regular: 'h-8 min-w-8 px-4 text-sm', icon: 'size-8 p-0 text-sm' },
} as const;

export function Button({
  className,
  prefix,
  suffix,
  children,
  variant = 'primary',
  size = 'md',
  type = 'button',
  ...props
}: ButtonProps) {
  const iconOnly = children == null && (prefix != null || suffix != null);

  return (
    <BaseButton
      className={cn(
        'inline-flex shrink-0 cursor-pointer items-center justify-center gap-1 whitespace-nowrap rounded-sm border font-normal leading-none disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        sizes[size][iconOnly ? 'icon' : 'regular'],
        className,
      )}
      type={type}
      {...props}
    >
      {prefix != null && (
        <span aria-hidden="true" className="inline-flex shrink-0 items-center justify-center">
          {prefix}
        </span>
      )}
      {children}
      {suffix != null && (
        <span aria-hidden="true" className="inline-flex shrink-0 items-center justify-center">
          {suffix}
        </span>
      )}
    </BaseButton>
  );
}
