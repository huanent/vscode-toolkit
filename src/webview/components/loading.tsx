import { cn } from 'cn';
import type { ComponentPropsWithRef, ReactNode } from 'react';
import { Icon } from '@/webview/components/icons';

export type LoadingProps = Omit<ComponentPropsWithRef<'div'>, 'children'> & {
  label?: ReactNode;
  variant?: 'block' | 'inline' | 'icon';
  size?: import('@/webview/components/icons').IconSize;
};

export function Loading({
  label = 'Loading...',
  className,
  variant = 'inline',
  size = variant === 'block' ? 'lg' : 'sm',
  ...props
}: LoadingProps) {
  return (
    <div
      className={cn(
        variant === 'block'
          ? 'flex min-h-36 min-w-0 flex-col items-center justify-center gap-3 px-3 py-6 text-center text-xs text-(--vscode-descriptionForeground)'
          : 'inline-flex min-w-0 shrink-0 items-center gap-2 align-middle',
        className,
      )}
      role="status"
      aria-live="polite"
      {...props}
    >
      <Icon name="loading" size={size} className="codicon-modifier-spin" />
      <span className={variant === 'icon' ? 'sr-only' : 'min-w-0 wrap-break-word'}>{label}</span>
    </div>
  );
}
