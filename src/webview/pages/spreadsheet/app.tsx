import { useEffect } from 'react';
import type { SpreadsheetSheet } from '@/features/excel/protocol';
import { mountWebview } from '@/webview/bootstrap';
import { SpreadsheetPreview } from '@/webview/pages/spreadsheet/components/spreadsheet-preview';
import { getRootData, useHostData } from '@/webview/utils/host-data';
import '@/webview/styles.css';

function App() {
  const state = useHostData<SpreadsheetSheet[]>();
  const name = getRootData('name') ?? 'Spreadsheet';

  useEffect(() => {
    document.title = name;
  }, [name]);

  if (state.status === 'loaded') return <SpreadsheetPreview sheets={state.data} />;

  return (
    <main className="grid min-h-screen place-items-center bg-(--vscode-editor-background) p-4 text-(--vscode-foreground)">
      {state.status === 'loading' ? (
        <p className="text-(--vscode-descriptionForeground)" role="status">
          Reading spreadsheet...
        </p>
      ) : (
        <p className="max-w-lg text-center text-(--vscode-errorForeground)" role="alert">
          {state.message}
        </p>
      )}
    </main>
  );
}

mountWebview('root', <App />);
