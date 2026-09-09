import { Field } from '../../../../components/field';
import { PasswordInput } from '../../../../components/input';
import type { ServerFormState } from '../hooks/useServerForm';

export function AuthenticationFields({ form }: { form: ServerFormState }) {
	const { values } = form;
	const credentialRequired = !values.password;
	return (
		<Field label="Password" required={credentialRequired}>
			<PasswordInput
				value={values.password}
				required={credentialRequired}
				onChange={event => form.update('password', event.target.value)}
			/>
		</Field>
	);
}
