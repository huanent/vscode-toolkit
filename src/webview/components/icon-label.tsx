import { cn } from 'cn';
import { Icon } from '@/webview/components/icons';

type IconLabelProps = {
  icon: string;
  label: string;
  title?: string;
  className?: string;
};

export function IconLabel({ icon, label, title, className }: IconLabelProps) {
  return (
    <div className={cn('flex min-w-0 items-center gap-1', className)}>
      <Icon name={icon} className="size-4" />
      <span className="truncate" title={title}>
        {label}
      </span>
    </div>
  );
}
