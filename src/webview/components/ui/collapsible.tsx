import { Collapsible as BaseCollapsible } from '@base-ui/react/collapsible';
import type { ReactNode } from 'react';
import { Icon } from '@/webview/components/ui/icons';

type CollapsibleProps = {
  title: ReactNode;
  children: ReactNode;
  className?: string;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function Collapsible({ title, children, className, defaultOpen = false, open, onOpenChange }: CollapsibleProps) {
  return (
    <BaseCollapsible.Root className={className} defaultOpen={defaultOpen} open={open} onOpenChange={onOpenChange}>
      <BaseCollapsible.Trigger className="group flex w-full cursor-pointer items-center gap-2 py-2 text-left font-semibold text-(--vscode-foreground)">
        <Icon name="chevron-right" size="sm" className="transition-transform group-data-panel-open:rotate-90" />
        {title}
      </BaseCollapsible.Trigger>
      <BaseCollapsible.Panel>{children}</BaseCollapsible.Panel>
    </BaseCollapsible.Root>
  );
}
