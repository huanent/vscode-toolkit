import { cn } from 'cn';

export type IconSize = 'sm' | 'md' | 'lg';
export type IconVariant = 'default' | 'muted';

export type IconProps = {
  name: string;
  size?: IconSize;
  variant?: IconVariant;
  className?: string;
};

const sizeClasses: Record<IconSize, string> = {
  sm: 'size-3 text-xs',
  md: 'size-4 text-base',
  lg: 'size-5 text-xl',
};

const variantClasses: Record<IconVariant, string> = {
  default: '',
  muted: 'text-(--vscode-descriptionForeground)',
};

export function Icon({ name, size = 'md', variant = 'default', className }: IconProps) {
  return (
    <span
      className={cn(
        'codicon inline-block shrink-0 leading-none',
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

export function FileIcon({ size = 'md' }: SizedIconProps = {}) {
  return (
    <Icon name="file" size={size} className="text-(--vscode-symbolIcon-fileForeground,var(--vscode-icon-foreground))" />
  );
}

export function FolderIcon({ expanded = false, size = 'md' }: SizedIconProps & { expanded?: boolean }) {
  return (
    <Icon
      name={expanded ? 'folder-opened' : 'folder'}
      size={size}
      className="text-(--vscode-symbolIcon-folderForeground,var(--vscode-icon-foreground))"
    />
  );
}

export function DisclosureIcon({ expanded, size = 'md' }: SizedIconProps & { expanded: boolean }) {
  return <Icon name="chevron-right" size={size} className={cn('transition-transform', expanded && 'rotate-90')} />;
}
