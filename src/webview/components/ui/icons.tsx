import { cn } from 'cn';

export type IconSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
export type IconVariant = 'default' | 'muted';

export type IconProps = {
  name: string;
  size?: IconSize;
  variant?: IconVariant;
  className?: string;
};

const sizeClasses: Record<IconSize, string> = {
  sm: 'text-sm/none!',
  md: 'text-base/none!',
  lg: 'text-lg/none!',
  xl: 'text-xl/none!',
  '2xl': 'text-2xl/none!',
  '3xl': 'text-3xl/none!',
};

const variantClasses: Record<IconVariant, string> = {
  default: '',
  muted: 'text-(--vscode-descriptionForeground)',
};

export function Icon({ name, size = 'md', variant = 'default', className }: IconProps) {
  return (
    <i
      className={cn(
        'codicon inline-flex! shrink-0 items-center justify-center',
        `codicon-${name}`,
        sizeClasses[size],
        variantClasses[variant],
        className,
      )}
      aria-hidden="true"
    />
  );
}
