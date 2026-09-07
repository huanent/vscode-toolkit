import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import type { SpreadsheetSheet } from '../../../../../../src/features/explorer/excel/types';
import { PreviewLoader } from '../../shared/components/PreviewLoader';
import '../../explorer.css';
import { SpreadsheetPreview } from './SpreadsheetPreview';

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
