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
  sm: 'text-sm!',
  md: 'text-base!',
  lg: 'text-lg!',
  xl: 'text-xl!',
  '2xl': 'text-2xl!',
  '3xl': 'text-3xl!',
};

const variantClasses: Record<IconVariant, string> = {
  default: '',
  muted: 'text-(--vscode-descriptionForeground)',
};

export function Icon({ name, size = 'md', variant = 'default', className }: IconProps) {
  return (
    <i
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
