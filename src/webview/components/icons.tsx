import { cn } from 'cn';

export type IconSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
export type IconVariant = 'default' | 'muted';

export type IconProps = {
  name: string;
  size?: IconSize;
  variant?: IconVariant;
  className?: string;
};

// Important modifier: codicon.css sets font-size outside Tailwind layers.
const sizeClasses: Record<IconSize, string> = {
  sm: 'text-sm!',
  md: 'text-xl!',
  lg: 'text-2xl!',
  xl: 'text-3xl!',
  '2xl': 'text-4xl!',
  '3xl': 'text-5xl!',
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
