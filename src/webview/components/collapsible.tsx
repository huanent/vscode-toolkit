import { Collapsible as BaseCollapsible } from '@base-ui/react/collapsible';
import type { ReactNode } from 'react';
import { Icon } from '@/webview/components/icons';

interface CollapsibleProps {
  title: ReactNode;
  children: ReactNode;
  className?: string;
  defaultOpen?: boolean;
}

export function Collapsible({ title, children, className, defaultOpen = false }: CollapsibleProps) {
  return (
    <BaseCollapsible.Root className={className} defaultOpen={defaultOpen}>
      <BaseCollapsible.Trigger className="group flex w-full cursor-pointer items-center gap-2 py-2 text-left text-xs font-semibold text-(--vscode-foreground)">
        <span className="inline-flex transition-transform group-data-panel-open:rotate-90" aria-hidden="true">
          <Icon name="chevron-right" size="sm" />
        </span>
        {title}
      </BaseCollapsible.Trigger>
      <BaseCollapsible.Panel>{children}</BaseCollapsible.Panel>
    </BaseCollapsible.Root>
  );
}
