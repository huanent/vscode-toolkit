import { useConnectionForm } from '../hooks/useConnectionForm';
import { Dialog } from '../../../../components/dialog';
import { ConnectionForm } from './connectionForm';

export function ConnectionDialog({
	sessionId,
	onClose,
	presentation = 'dialog',
}: {
	sessionId: number;
	onClose: () => void;
	presentation?: 'dialog' | 'editor';
}) {
	const form = useConnectionForm(sessionId, onClose);
	const title = form.model?.server?.host ? 'Edit SSH connection' : 'New SSH connection';
	const content = form.model ? <ConnectionForm form={form} /> : <p role="status">Loading...</p>;
	return presentation === 'editor' ? (
		<section aria-label={title} className="min-w-0">
			<h1 className="mb-4 border-b border-(--vscode-panel-border) pb-3 text-base font-semibold">
				{title}
			</h1>
			{content}
		</section>
	) : (
		<Dialog open title={title} size="lg" closeDisabled={form.saving} onClose={onClose}>
			{content}
		</Dialog>
	);
}
