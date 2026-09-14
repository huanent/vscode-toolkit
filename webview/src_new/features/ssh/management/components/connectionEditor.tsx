import { useConnectionForm } from '../hooks/useConnectionForm';
import { ConnectionForm } from './connectionForm';

export function ConnectionEditor({
	sessionId,
	onClose,
}: {
	sessionId: number;
	onClose: () => void;
}) {
	const form = useConnectionForm(sessionId, onClose);
	const title = form.model?.server?.host ? 'Edit SSH connection' : 'New SSH connection';
	return (
		<section aria-label={title} className="min-w-0">
			<h1 className="mb-4 border-b border-(--vscode-panel-border) pb-3 text-base font-semibold">
				{title}
			</h1>
			{form.model ? <ConnectionForm form={form} /> : <p role="status">Loading...</p>}
		</section>
	);
}