import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import type { ArchiveTreeEntry } from '../../../../../src/explorer/archive/protocol';
import { PreviewLoader } from '../../shared/components/previewLoader';
import '../../explorer.css';
import { ArchiveContents } from './archiveContents';

const root = document.getElementById('root');
if (!root) throw new Error('The archive preview root element is missing.');

const name = root.dataset.name ?? '';

createRoot(root).render(
	<StrictMode>
		<PreviewLoader<ArchiveTreeEntry[]>
			loadingLabel="Reading archive..."
			errorLabel="Unable to read archive"
			render={entries => <ArchiveContents name={name} entries={entries} />}
		/>
	</StrictMode>,
);
