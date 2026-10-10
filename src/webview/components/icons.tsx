import { cn } from 'cn';
import type { HTMLAttributes } from 'react';

export type IconSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
export type IconVariant = 'default' | 'muted';

export type IconProps = Omit<HTMLAttributes<HTMLElement>, 'children'> & {
  name: string;
  size?: IconSize;
  variant?: IconVariant;
  className?: string;
};

const sizeClasses: Record<IconSize, string> = {
  sm: '!text-[12px]',
  md: '!text-[16px]',
  lg: '!text-[20px]',
  xl: '!text-[24px]',
  '2xl': '!text-[32px]',
  '3xl': '!text-[40px]',
};

const variantClasses: Record<IconVariant, string> = {
  default: '',
  muted: 'text-(--vscode-descriptionForeground)',
};

export function Icon({ name, size = 'md', variant = 'default', className, ...props }: IconProps) {
  return (
    <i
      {...props}
      className={cn(
        'codicon shrink-0 leading-none',
        `codicon-${name}`,
        sizeClasses[size],
        variantClasses[variant],
        className,
      )}
      aria-hidden="true"
    />
  );
}

type SizedIconProps = Pick<IconProps, 'size'>;

export function DisclosureIcon({ expanded, size = 'md' }: SizedIconProps & { expanded: boolean }) {
  return <Icon name="chevron-right" size={size} className={cn('transition-transform', expanded && 'rotate-90')} />;
}
