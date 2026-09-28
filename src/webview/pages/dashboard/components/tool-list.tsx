import { cn } from 'cn';
import { tools } from '@/webview/pages/dashboard/model/tools';

type ToolListProps = {
  activeToolId: string;
  onSelect: (toolId: string) => void;
};

export function ToolList({ activeToolId, onSelect }: ToolListProps) {
  return (
    <section className="grid gap-2" aria-label="Toolkit tools">
      {tools.map((tool) => (
        <button
          className={cn(
            'grid w-full grid-cols-8 items-center gap-3 border bg-transparent px-3 py-3 text-left text-(--vscode-foreground) transition-colors',
            activeToolId === tool.id
              ? 'border-(--vscode-focusBorder) bg-(--vscode-list-hoverBackground)'
              : 'border-transparent hover:border-(--vscode-focusBorder) hover:bg-(--vscode-list-hoverBackground)',
          )}
          key={tool.name}
          onClick={() => onSelect(tool.id)}
          type="button"
        >
          <span
            className="col-span-1 grid size-7 place-items-center bg-(--vscode-textLink-foreground)/15 text-base text-(--vscode-textLink-foreground)"
            aria-hidden="true"
          >
            {tool.icon}
          </span>
          <span className="col-span-5 grid min-w-0 gap-1">
            <strong className="text-sm">{tool.name}</strong>
            <span className="overflow-hidden text-ellipsis whitespace-nowrap text-xs text-(--vscode-descriptionForeground)">
              {tool.description}
            </span>
          </span>
          <span className="col-span-2 max-w-32 overflow-hidden text-ellipsis whitespace-nowrap text-xs text-(--vscode-descriptionForeground)">
            {tool.status}
          </span>
        </button>
      ))}
    </section>
  );
}
