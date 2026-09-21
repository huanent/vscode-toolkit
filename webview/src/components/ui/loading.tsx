import { cn } from 'cn';
import type { ComponentPropsWithRef, ReactNode } from 'react';
import { LoaderCircle, type IconSize } from './icons';

export type LoadingProps = Omit<ComponentPropsWithRef<'span'>, 'children'> & {
    label?: ReactNode;
    variant?: 'block' | 'inline' | 'icon';
    size?: IconSize;
};

export function Loading({ label = 'Loading...', variant = 'block', size = variant === 'block' ? 'lg' : 'sm', className, ...props }: LoadingProps) {
    return (
        <span
            role="status"
            className={cn(
                variant === 'block'
                    ? 'flex min-h-36 min-w-0 flex-col items-center justify-center gap-3 px-3 py-6 text-center text-xs text-(--vscode-descriptionForeground)'
                    : 'inline-flex min-w-0 shrink-0 items-center gap-2 align-middle',
                className,
            )}
            {...props}
        >
            <LoaderCircle size={size} className="shrink-0 motion-safe:animate-spin" aria-hidden="true" />
            <span className={variant === 'icon' ? 'sr-only' : 'max-w-full wrap-anywhere'}>{label}</span>
        </span>
    );
}