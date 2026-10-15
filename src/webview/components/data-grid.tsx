import { cn } from 'cn';
import type { Key, ReactNode } from 'react';

type DataGridProps<T> = {
  ariaLabel: string;
  entries: readonly T[];
  entryKey: (entry: T) => Key;
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
        <li key={entryKey(entry)} className="w-24 max-w-full min-w-0">
          <button
            type="button"
            title={title?.(entry)}
            className="flex h-20 w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-sm border border-transparent px-2 py-1 transition-colors hover:bg-(--vscode-list-hoverBackground) focus-visible:border-(--vscode-focusBorder) focus-visible:bg-(--vscode-list-hoverBackground)"
            onDoubleClick={() => onOpen(entry)}
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
