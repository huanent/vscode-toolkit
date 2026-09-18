import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { vscode } from '@webview/vscodeApi';
import { WorkflowEditor } from './components/workflowEditor';
import { useWorkflow } from './hooks/useWorkflow';

function App() {
    const controller = useWorkflow();
    useEffect(() => {
        const receive = (event: MessageEvent) => {
            if (event.data.type === 'editorRequest') {
                window.dispatchEvent(new CustomEvent('toolkitEdit', { detail: event.data.request }));
            }
        };
        window.addEventListener('message', receive);
        vscode.postMessage({ type: 'editorReady' });
        return () => window.removeEventListener('message', receive);
    }, []);
    return (
        <main className="mx-auto max-w-6xl p-4 text-(--vscode-foreground)">
            <WorkflowEditor controller={controller} />
        </main>
    );
}

createRoot(document.getElementById('root')!).render(<App />);