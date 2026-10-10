import { Loading as SourceLoading, type LoadingProps as SourceLoadingProps } from '@/webview/components/loading';
import type { IconSize as SourceIconSize } from '@/webview/components/icons';
import type { IconSize } from '@/webview/components/ui/icons';

export type LoadingProps = Omit<SourceLoadingProps, 'size'> & { size?: IconSize };

const sourceSizes: Record<IconSize, SourceIconSize> = {
    xs: 'sm',
    sm: 'sm',
    md: 'md',
    lg: 'lg',
    xl: 'xl',
    '2xl': '2xl',
};

export function Loading({ variant = 'block', size = variant === 'block' ? 'lg' : 'sm', ...props }: LoadingProps) {
    return <SourceLoading {...props} variant={variant} size={sourceSizes[size]} />;
}