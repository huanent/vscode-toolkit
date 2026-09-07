import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../explorer.css';
import { SqliteManager } from './SqliteManager';

const root = document.getElementById('root');
if (!root) {
	throw new Error('The SQLite manager root element is missing.');
}

createRoot(root).render(
	<StrictMode>
		<SqliteManager name={root.dataset.name ?? ''} />
	</StrictMode>,
);
