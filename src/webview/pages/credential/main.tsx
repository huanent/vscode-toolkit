import { createRoot } from 'react-dom/client';
import { Credentials } from './app';

createRoot(document.getElementById('root')!).render(
    <main className="h-full min-w-0 px-4 text-(--vscode-foreground)">
        <Credentials />
    </main>,
);