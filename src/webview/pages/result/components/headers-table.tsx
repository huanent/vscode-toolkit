interface HeadersTableProps {
  headers: Record<string, string>;
}

export function HeadersTable({ headers }: HeadersTableProps) {
  const entries = Object.entries(headers);

  if (entries.length === 0) {
    return <div className="p-3 text-sm text-(--vscode-descriptionForeground)">No headers</div>;
  }

  return (
    <div className="overflow-x-auto border border-(--vscode-panel-border)">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-(--vscode-panel-border) bg-(--vscode-editor-inactiveSelectionBackground)">
            <th className="p-2 font-medium">Header</th>
            <th className="p-2 font-medium">Value</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([name, value]) => (
            <tr key={name} className="border-b border-(--vscode-panel-border) last:border-b-0">
              <td className="p-2 font-mono text-xs font-semibold text-(--vscode-symbolIcon-propertyForeground)">
                {name}
              </td>
              <td className="p-2 font-mono text-xs break-all text-(--vscode-foreground)">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
