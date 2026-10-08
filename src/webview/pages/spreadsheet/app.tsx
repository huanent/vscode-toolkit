import { useEffect, useState } from 'react';
import type { SpreadsheetSheet } from '@/features/spreadsheet/protocol';
import { mountWebview } from '@/webview/bootstrap';
import { Loading } from '@/webview/components/loading';
import { TabPanel, Tabs } from '@/webview/components/tabs';
import { getRootData, useHostData } from '@/webview/utils/host-data';
import '@/webview/styles.css';

function App() {
  const state = useHostData<SpreadsheetSheet[]>();
  const name = getRootData('name') ?? 'Spreadsheet';
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);

  useEffect(() => {
    document.title = name;
  }, [name]);

  useEffect(() => setActiveSheetIndex(0), [state.status === 'loaded' ? state.data : undefined]);

  if (state.status === 'loaded') {
    return (
      <main
        className="flex h-dvh select-text flex-col overflow-hidden bg-(--vscode-editor-background) text-(--vscode-foreground)"
        aria-labelledby="spreadsheet-preview-title"
      >
        <Tabs
          tabs={state.data.map((item, index) => ({ id: String(index), label: item.name }))}
          activeTabId={String(activeSheetIndex)}
          onChange={(value) => setActiveSheetIndex(Number(value))}
          ariaLabel="Worksheets"
          placement="bottom"
          hideSingleTab
          className="flex min-h-0 flex-1 flex-col"
          contentClassName="min-h-0 flex-1 overflow-auto"
        >
          {state.data.length ? (
            state.data.map((item, index) => (
              <TabPanel key={`${item.name}-${index}`} tabId={String(index)}>
                {item.rows.length ? (
                  <SpreadsheetTable rows={item.rows} />
                ) : (
                  <div className="grid h-full place-items-center text-(--vscode-descriptionForeground)">
                    This spreadsheet is empty.
                  </div>
                )}
              </TabPanel>
            ))
          ) : (
            <div className="grid h-full place-items-center text-(--vscode-descriptionForeground)">
              This spreadsheet is empty.
            </div>
          )}
        </Tabs>
      </main>
    );
  }

  return (
    <main className="grid min-h-screen place-items-center bg-(--vscode-editor-background) p-4 text-(--vscode-foreground)">
      {state.status === 'loading' ? (
        <Loading label="Reading spreadsheet..." />
      ) : (
        <p className="max-w-lg text-center text-(--vscode-errorForeground)" role="alert">
          {state.message}
        </p>
      )}
    </main>
  );
}

function SpreadsheetTable({ rows }: { rows: string[][] }) {
  const columnCount = Math.max(0, ...rows.map((row) => row.length));
  return (
    <table className="border-separate border-spacing-0 text-xs">
      <thead className="sticky top-0 z-2">
        <tr>
          <th className="sticky left-0 z-3 h-7 min-w-12 border-r border-b border-(--vscode-panel-border) bg-(--vscode-sideBar-background)" />
          {Array.from({ length: columnCount }, (_, index) => (
            <th
              key={index}
              className="h-7 min-w-28 max-w-80 border-r border-b border-(--vscode-panel-border) bg-(--vscode-sideBar-background) px-2 text-center font-normal text-(--vscode-descriptionForeground)"
            >
              {getColumnName(index)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr key={rowIndex}>
            <th className="sticky left-0 z-1 h-7 min-w-12 border-r border-b border-(--vscode-panel-border) bg-(--vscode-sideBar-background) px-2 text-right font-normal text-(--vscode-descriptionForeground)">
              {rowIndex + 1}
            </th>
            {Array.from({ length: columnCount }, (_, columnIndex) => (
              <td
                key={columnIndex}
                className="h-7 min-w-28 max-w-80 overflow-hidden border-r border-b border-(--vscode-panel-border) px-2 text-ellipsis whitespace-nowrap"
                title={row[columnIndex] ?? ''}
              >
                {row[columnIndex] ?? ''}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function getColumnName(index: number): string {
  let name = '';
  for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26)) {
    name = String.fromCharCode(65 + ((value - 1) % 26)) + name;
  }
  return name;
}

mountWebview('root', <App />);
