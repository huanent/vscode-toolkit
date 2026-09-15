import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import type { SpreadsheetSheet } from '../../../../../src/explorer/excel/protocol';
import { PreviewLoader } from '../../shared/components/previewLoader';
import '../../explorer.css';
import { SpreadsheetPreview } from './spreadsheetPreview';

const root = document.getElementById('root');
if (!root) {
	throw new Error('The spreadsheet preview root element is missing.');
}

const name = root.dataset.name ?? '';

createRoot(root).render(
	<StrictMode>
		<PreviewLoader<SpreadsheetSheet[]>
			loadingLabel="Reading spreadsheet..."
			errorLabel="Unable to read spreadsheet"
			render={sheets => <SpreadsheetPreview name={name} sheets={sheets} />}
		/>
	</StrictMode>,
);
