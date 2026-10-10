import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ConnectionEditor } from './components/connectionEditor';

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<ConnectionEditor />
	</StrictMode>,
);
