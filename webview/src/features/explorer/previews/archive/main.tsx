import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import type { ArchiveTreeEntry } from '../../../../../../shared/protocol/explorer/archive';
import { PreviewLoader } from '../../shared/components/PreviewLoader';
import '../../explorer.css';
import { ArchiveContents } from './ArchiveContents';

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
