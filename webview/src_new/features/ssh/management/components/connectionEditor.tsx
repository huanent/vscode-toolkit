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
	return (
		<section className="min-w-0">
			<ConnectionForm form={form} />
		</section>
	);
}