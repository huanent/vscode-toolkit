import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { vscode } from '@webview/vscodeApi';
import { subscribe } from '../vscode';
import { ConnectionEditor } from './components/connectionEditor';
import { Loading } from '../../components/ui/loading';

const close = () => vscode.postMessage({ type: 'closeEditor' });
document.body.dataset.toolkitEditor = 'true';

function App() {
    const [sessionId, setSessionId] = useState<number>();
    useEffect(() => {
        const unsubscribe = subscribe(event => {
            if (event.data.type === 'openForm') setSessionId(event.data.sessionId);
            if (event.data.type === 'formClosed') close();
        });
        vscode.postMessage({ type: 'editorReady' });
        return unsubscribe;
    }, []);
    return (
        <main className="mx-auto max-w-6xl p-4 text-(--vscode-foreground)">
            {sessionId === undefined ? (
                <Loading />
            ) : (
                <ConnectionEditor key={sessionId} sessionId={sessionId} onClose={close} />
            )}
        </main>
    );
}

createRoot(document.getElementById('root')!).render(<App />);