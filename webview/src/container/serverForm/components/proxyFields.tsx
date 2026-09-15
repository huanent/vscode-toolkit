import { IconButton } from '@webview/components/ui/button';
import { Field } from '@webview/components/ui/field';
import { KeyRound } from '@webview/components/ui/icons';
import { PasswordInput, Textarea as TextArea, Input as TextInput } from '@webview/components/ui/input';
import { Segmented as SegmentedControl } from '@webview/components/ui/segmented';
import type { ServerFormState } from '../hooks/useServerForm';

export function ProxyFields({ form }: { form: ServerFormState }) {
	const { values } = form;
	const credentialRequired =
		values.proxyAuthType === 'privateKey' ? !values.proxyPrivateKey : !values.proxyPassword;
	const updateProxyMode = (mode: 'none' | 'ssh' | 'command') => {
		form.update('proxyMode', mode);
		form.update('proxyEnabled', mode === 'ssh');
		if (mode === 'none') {
			form.update('proxyCommand', '');
		}
	};
	const updateProxy = <
		Key extends
		| 'proxyHost'
		| 'proxyPort'
		| 'proxyUsername'
		| 'proxyAuthType'
		| 'proxyPassword'
		| 'proxyPrivateKey'
		| 'proxyPassphrase',
	>(
		key: Key,
		value: ServerFormState['values'][Key],
	) => {
		if (values.sshServerId) {
			form.update('sshServerId', '');
		}
		form.update(key, value);
	};
	return (
		<section aria-labelledby="proxy-heading">
			<h2 className="mt-0 mb-3.5 text-sm font-semibold" id="proxy-heading">
				Proxy settings
			</h2>
			<div className="grid gap-3.5">
				<SegmentedControl
					label="Proxy type"
					value={values.proxyMode}
					options={[
						{ value: 'none', label: 'None' },
						{ value: 'ssh', label: 'SSH' },
						{ value: 'command', label: 'Proxy command' },
					]}
					onChange={updateProxyMode}
				/>
				{values.proxyMode === 'ssh' && (
					<>
						<div className="grid grid-cols-[minmax(0,1fr)_112px] gap-3 max-[440px]:grid-cols-1">
							<Field label="SSH host" required>{control => <>
								<TextInput {...control}
									required
									placeholder="bastion.example.com"
									value={values.proxyHost}
									onChange={event => updateProxy('proxyHost', event.target.value)}
								/>
							</>}</Field>
							<Field label="Port" required>{control => <>
								<TextInput {...control}
									required
									type="number"
									min={1}
									max={65535}
									value={values.proxyPort}
									onChange={event => updateProxy('proxyPort', event.target.value)}
								/>
							</>}</Field>
						</div>
						<Field label="Username" required>{control => <>
							<TextInput {...control}
								required
								autoComplete="username"
								placeholder="root"
								value={values.proxyUsername}
								onChange={event => updateProxy('proxyUsername', event.target.value)}
							/>
						</>}</Field>
						<SegmentedControl
							label="SSH authentication method"
							value={values.proxyAuthType}
							options={[
								{ value: 'password', label: 'Password' },
								{ value: 'privateKey', label: 'Private key' },
							]}
							onChange={value => updateProxy('proxyAuthType', value)}
						/>
						{values.proxyAuthType === 'password' ? (
							<Field label="SSH password" required={credentialRequired}>{control => <>
								<PasswordInput {...control}
									value={values.proxyPassword}
									required={credentialRequired}
									onChange={event => updateProxy('proxyPassword', event.target.value)}
								/>
							</>}</Field>
						) : (
							<>
								<Field
									label="SSH private key"
									required={credentialRequired}
									action={
										<IconButton label="Select proxy private key" icon={<><KeyRound size="sm" /></>}
											className="size-6 border-0"
											htmlType="button"
											title="Select proxy private key"
											aria-label="Select proxy private key"
											onClick={form.selectProxyPrivateKey}
										></IconButton>
									}
								>{control => <>
									<TextArea {...control}
										required={credentialRequired}
										spellCheck={false}
										placeholder="Paste the PEM or OpenSSH private key"
										value={values.proxyPrivateKey}
										onChange={event => updateProxy('proxyPrivateKey', event.target.value)}
									/>
								</>}</Field>
								<Field label="SSH key passphrase">{control => <>
									<PasswordInput {...control}
										placeholder="Optional"
										value={values.proxyPassphrase}
										onChange={event => updateProxy('proxyPassphrase', event.target.value)}
									/>
								</>}</Field>
							</>
						)}
					</>
				)}
				{values.proxyMode === 'command' && (
					<Field label="Proxy command" required>{control => <>
						<TextInput {...control}
							required
							spellCheck={false}
							placeholder="cloudflared access tcp --hostname example.com"
							value={values.proxyCommand}
							onChange={event => form.update('proxyCommand', event.target.value)}
						/>
					</>}</Field>
				)}
			</div>
		</section>
	);
}
