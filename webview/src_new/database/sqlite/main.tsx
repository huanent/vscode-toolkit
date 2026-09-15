import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SqliteManager } from './sqliteManager';

const root = document.getElementById('root');
if (!root) {
	throw new Error('The SQLite manager root element is missing.');
}

createRoot(root).render(
	<StrictMode>
		<SqliteManager />
	</StrictMode>,
);
