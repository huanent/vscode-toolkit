import { CredentialFields } from '../../../components/credentialFields';
import type { ServerFormState } from '../hooks/useServerForm';

export function AuthenticationFields({ form }: { form: ServerFormState }) {
	return <CredentialFields types={['password']} value={form.values.credentialId} disabled={form.saving} onChange={credential => {
		form.update('credentialId', credential?.id ?? '');
	}} />;
}
