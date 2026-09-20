import { CredentialFields } from '../../../components/credentialFields';
import type { ConnectionFormState } from '../hooks/useForm';

export function AuthenticationFields({ form }: { form: ConnectionFormState }) {
	return <CredentialFields types={['password', 'privateKey']} value={form.values.credentialId} disabled={form.saving} onChange={credential => {
		form.update('credentialId', credential?.id ?? '');
	}} />;
}
