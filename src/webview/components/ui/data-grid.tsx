import { cn } from 'cn';
import type { Key, MouseEvent, ReactNode } from 'react';

type DataGridProps<T> = {
  ariaLabel: string;
  entries: readonly T[];
  entryKey: (entry: T) => Key;
  entryContext?: (entry: T) => Record<string, unknown>;
  isSelected?: (entry: T) => boolean;
  onSelect?: (entry: T, event: MouseEvent<HTMLElement>) => void;
  label: (entry: T) => ReactNode;
  icon?: (entry: T) => ReactNode;
  title?: (entry: T) => string;
  onOpen: (entry: T) => void;
  emptyMessage?: ReactNode;
  className?: string;
};

export function DataGrid<T>({
  ariaLabel,
  entries,
  entryKey,
  entryContext,
  isSelected,
  onSelect,
  label,
  icon,
  title,
  onOpen,
  emptyMessage = 'No items.',
  className,
}: DataGridProps<T>) {
  return (
    <ul
      aria-label={ariaLabel}
      className={cn('flex min-h-0 flex-1 flex-wrap content-start gap-1 overflow-auto p-2 select-none', className)}
    >
      {entries.map((entry) => (
        <li
          key={entryKey(entry)}
          data-vscode-context={entryContext ? JSON.stringify(entryContext(entry)) : undefined}
          className="w-24 max-w-full min-w-0"
        >
          <button
            type="button"
            title={title?.(entry)}
            aria-pressed={isSelected?.(entry)}
            className={cn(
              'flex h-20 w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-sm border border-transparent px-2 py-1 transition-colors focus-visible:border-(--vscode-focusBorder)',
              isSelected?.(entry)
                ? 'bg-(--vscode-list-activeSelectionBackground) text-(--vscode-list-activeSelectionForeground)'
                : 'hover:bg-(--vscode-list-hoverBackground) focus-visible:bg-(--vscode-list-hoverBackground)',
            )}
            onClick={onSelect ? (event) => onSelect(entry, event) : undefined}
            onDoubleClick={(event) => {
              if (!event.shiftKey && !event.ctrlKey && !event.metaKey) onOpen(entry);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') onOpen(entry);
            }}
          >
            {icon && <div className="flex size-8 shrink-0 items-center justify-center">{icon(entry)}</div>}
            <div className="line-clamp-2 h-8 w-full wrap-anywhere text-center text-sm leading-4">{label(entry)}</div>
          </button>
        </li>
      ))}
      {!entries.length && (
        <li className="w-full py-4 text-center text-(--vscode-descriptionForeground)">{emptyMessage}</li>
      )}
    </ul>
  );
}
