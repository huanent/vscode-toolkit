import { IconButton } from '../../../../components/button';
import { Field } from '../../../../components/field';
import { KeyRound } from '../../../../components/icons';
import { PasswordInput, Textarea } from '../../../../components/input';
import { Segmented } from '../../../../components/segmented';
import type { ConnectionFormState } from '../hooks/useConnectionForm';

export function AuthenticationFields({ form }: { form: ConnectionFormState }) {
	const { values } = form;
	const credentialRequired =
		values.authType === 'privateKey' ? !values.privateKey : !values.password;
	return (
		<>
			{
				<Segmented
					label="Authentication method"
					value={values.authType}
					options={[
						{ value: 'password', label: 'Password' },
						{ value: 'privateKey', label: 'Private key' },
					]}
					onChange={value => form.update('authType', value)}
				/>
			}
			{values.authType === 'password' ? (
				<Field label="Password" required={credentialRequired}>
					{control => (
						<>
							<PasswordInput
								{...control}
								value={values.password}
								required={credentialRequired}
								onChange={event => form.update('password', event.target.value)}
							/>
						</>
					)}
				</Field>
			) : (
				<>
					<Field
						label="Private key"
						required={credentialRequired}
						action={
							<IconButton
								className="size-6 border-0"
								htmlType="button"
								label="Select private key"

								onClick={form.selectPrivateKey}
								icon={<KeyRound size="sm" />}
							/>
						}
					>
						{control => (
							<>
								<Textarea
									{...control}
									required={credentialRequired}
									spellCheck={false}
									placeholder="Paste the PEM or OpenSSH private key"
									value={values.privateKey}
									onChange={event => form.update('privateKey', event.target.value)}
								/>
							</>
						)}
					</Field>
					<Field label="Key passphrase">
						{control => (
							<>
								<PasswordInput
									{...control}
									placeholder="Optional"
									value={values.passphrase}
									onChange={event => form.update('passphrase', event.target.value)}
								/>
							</>
						)}
					</Field>
				</>
			)}
		</>
	);
}
