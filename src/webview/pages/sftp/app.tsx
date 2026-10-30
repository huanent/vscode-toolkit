import type { SftpEditorData } from '@/features/ssh/protocol';
import { mountWebview } from '@/webview/bootstrap';
import { Button } from '@/webview/components/ui/button';
import { ErrorMessage } from '@/webview/components/ui/error-message';
import { Icon } from '@/webview/components/ui/icons';
import { Loading } from '@/webview/components/ui/loading';
import { postToHost, useHostData } from '@/webview/utils/host-data';
import { FilePane } from './components/file-pane';
import '@/webview/styles.css';

function App() {
  const state = useHostData<SftpEditorData>();
  return (
    <main className="relative flex h-dvh flex-col overflow-hidden bg-(--vscode-editor-background) text-(--vscode-foreground)">
      {state.status === 'loading' ? (
        <Loading label="Loading files..." className="absolute inset-0 justify-center" />
      ) : state.status === 'error' ? (
        <div className="p-2">
          <ErrorMessage message={state.message} />
          <Button onClick={() => postToHost({ type: 'ready' })} prefix={<Icon name="refresh" />}>
            Retry
          </Button>
        </div>
      ) : (
        <>
          {(state.data.error || state.error) && <ErrorMessage message={state.data.error ?? state.error!} />}
          <div className="flex min-h-0 flex-1 overflow-x-auto">
            {(['local', 'remote'] as const).map((side) => (
              <div
                key={side}
                className="relative flex min-h-0 min-w-72 flex-1 basis-0 border-r border-(--vscode-panel-border) last:border-r-0"
                aria-busy={state.data.busy[side]}
              >
                <div className="flex min-h-0 min-w-0 flex-1" inert={state.data.busy[side]}>
                  <FilePane
                    side={side}
                    directory={state.data[side]}
                    busy={state.data.busy[side]}
                    favorites={state.data.favorites[side]}
                  />
                </div>
                {state.data.busy[side] && <Loading label="Loading files..." full />}
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}

mountWebview('root', <App />);
