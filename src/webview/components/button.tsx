import { Button as BaseButton } from '@base-ui/react/button';
import type { ButtonProps as BaseButtonProps } from '@base-ui/react/button';
import { cn } from 'cn';

type ButtonProps = Omit<BaseButtonProps, 'className'> & {
  className?: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md';
};

const variantClasses = {
  primary:
    'bg-(--vscode-button-background) text-(--vscode-button-foreground) hover:bg-(--vscode-button-hoverBackground)',
  secondary:
    'border border-(--vscode-button-secondaryBackground) bg-(--vscode-button-secondaryBackground) text-(--vscode-button-secondaryForeground) hover:bg-(--vscode-button-secondaryHoverBackground)',
  ghost: 'bg-transparent text-(--vscode-foreground) hover:bg-(--vscode-list-hoverBackground)',
} as const;

const sizeClasses = {
  sm: 'px-2 py-1 text-sm rounded-sm',
  md: 'px-3 py-2 text-md rounded-md',
} as const;

export function Button({ className, variant = 'primary', size = 'md', type = 'button', ...props }: ButtonProps) {
  return (
    <BaseButton
      className={cn(
        'inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 border-0 transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      type={type}
      {...props}
    />
  );
}
