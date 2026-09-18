import { useForm } from '../hooks/useForm';
import { ConnectionForm } from './connectionForm';

export function ConnectionEditor({
	sessionId,
	onClose,
}: {
	sessionId: number;
	onClose: () => void;
}) {
	const form = useForm(sessionId, onClose);
	return (
		<section className="min-w-0">
			<ConnectionForm form={form} />
		</section>
	);
}