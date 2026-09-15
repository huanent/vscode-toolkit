import { useServerForm } from '../hooks/useServerForm';
import { ConnectionForm } from './connectionForm';

export function ConnectionEditor() {
	const form = useServerForm();
	return <ConnectionForm form={form} />;
}