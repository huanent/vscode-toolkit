import { IconButton } from '../../../../components/button';
import { Field } from '../../../../components/field';
import { KeyRound } from '../../../../components/icons';
import { PasswordInput, TextArea } from '../../../../components/input';
import { SegmentedControl } from '../../../../components/segmentedControl';
import type { ServerFormState } from '../hooks/useServerForm';

export function AuthenticationFields({ form }: { form: ServerFormState }) {
	const { values } = form;
	const credentialRequired =
		values.authType === 'privateKey' ? !values.privateKey : !values.password;
	return (
		<>
			{
				<SegmentedControl
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
					<PasswordInput
						value={values.password}
						required={credentialRequired}
						onChange={event => form.update('password', event.target.value)}
					/>
				</Field>
			) : (
				<>
					<Field
						label="Private key"
						required={credentialRequired}
						action={
							<IconButton
								className="size-6 border-0"
								type="button"
								title="Select private key"
								aria-label="Select private key"
								onClick={form.selectPrivateKey}
							>
								<KeyRound size={14} />
							</IconButton>
						}
					>
						<TextArea
							required={credentialRequired}
							spellCheck={false}
							placeholder="Paste the PEM or OpenSSH private key"
							value={values.privateKey}
							onChange={event => form.update('privateKey', event.target.value)}
						/>
					</Field>
					<Field label="Key passphrase">
						<PasswordInput
							placeholder="Optional"
							value={values.passphrase}
							onChange={event => form.update('passphrase', event.target.value)}
						/>
					</Field>
				</>
			)}
		</>
	);
}
