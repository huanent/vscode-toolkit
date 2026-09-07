import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../explorer.css';
import { App } from './App';

const root = document.getElementById('root');
if (!root) {
	throw new Error('The Explorer root element is missing.');
}

createRoot(root).render(
	<StrictMode>
		<App rootElement={root} />
	</StrictMode>,
);
