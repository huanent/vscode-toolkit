import { IconButton } from './ui/button';
import { Field } from './ui/field';
import { KeyRound } from './ui/icons';
import { PasswordInput, Textarea, Input } from './ui/input';
import { Segmented } from './ui/segmented';

export interface ProxyFieldValues {
	proxyMode: 'none' | 'ssh' | 'command';
	proxyEnabled: boolean;
	proxyCommand: string;
	proxyHost: string;
	proxyPort: string;
	proxyUsername: string;
	proxyAuthType: 'password' | 'privateKey';
	proxyPassword: string;
	proxyPrivateKey: string;
	proxyPassphrase: string;
}

export interface ProxyFieldsProps {
	values: ProxyFieldValues;
	onChange: <Key extends keyof ProxyFieldValues>(key: Key, value: ProxyFieldValues[Key]) => void;
	onSelectPrivateKey: () => void;
}

export function ProxyFields({ values, onChange, onSelectPrivateKey }: ProxyFieldsProps) {
	const credentialRequired =
		values.proxyAuthType === 'privateKey' ? !values.proxyPrivateKey : !values.proxyPassword;
	const updateProxyMode = (mode: ProxyFieldValues['proxyMode']) => {
		onChange('proxyMode', mode);
		onChange('proxyEnabled', mode === 'ssh');
		if (mode === 'none') {
			onChange('proxyCommand', '');
		}
	};
	return (
		<section aria-labelledby="proxy-heading">
			<h2 className="mt-0 mb-3.5 text-sm font-semibold" id="proxy-heading">
				Proxy settings
			</h2>
			<div className="grid gap-3.5">
				<Segmented
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
							<Field label="SSH host" required>
								{control => (
									<Input
										{...control}
										required
										placeholder="bastion.example.com"
										value={values.proxyHost}
										onChange={event => onChange('proxyHost', event.target.value)}
									/>
								)}
							</Field>
							<Field label="Port" required>
								{control => (
									<Input
										{...control}
										required
										type="number"
										min={1}
										max={65535}
										value={values.proxyPort}
										onChange={event => onChange('proxyPort', event.target.value)}
									/>
								)}
							</Field>
						</div>
						<Field label="Username" required>
							{control => (
								<Input
									{...control}
									required
									autoComplete="username"
									placeholder="root"
									value={values.proxyUsername}
									onChange={event => onChange('proxyUsername', event.target.value)}
								/>
							)}
						</Field>
						<Segmented
							label="SSH authentication method"
							value={values.proxyAuthType}
							options={[
								{ value: 'password', label: 'Password' },
								{ value: 'privateKey', label: 'Private key' },
							]}
							onChange={value => onChange('proxyAuthType', value)}
						/>
						{values.proxyAuthType === 'password' ? (
							<Field label="SSH password" required={credentialRequired}>
								{control => (
									<PasswordInput
										{...control}
										value={values.proxyPassword}
										required={credentialRequired}
										onChange={event => onChange('proxyPassword', event.target.value)}
									/>
								)}
							</Field>
						) : (
							<>
								<Field
									label="SSH private key"
									required={credentialRequired}
									action={
										<IconButton
											size="sm"
											htmlType="button"
											label="Select proxy private key"
											onClick={onSelectPrivateKey}
											icon={<KeyRound size="sm" />}
										/>
									}
								>
									{control => (
										<Textarea
											{...control}
											required={credentialRequired}
											spellCheck={false}
											placeholder="Paste the PEM or OpenSSH private key"
											value={values.proxyPrivateKey}
											onChange={event => onChange('proxyPrivateKey', event.target.value)}
										/>
									)}
								</Field>
								<Field label="SSH key passphrase">
									{control => (
										<PasswordInput
											{...control}
											placeholder="Optional"
											value={values.proxyPassphrase}
											onChange={event => onChange('proxyPassphrase', event.target.value)}
										/>
									)}
								</Field>
							</>
						)}
					</>
				)}
				{values.proxyMode === 'command' && (
					<Field label="Proxy command" required>
						{control => (
							<Input
								{...control}
								required
								spellCheck={false}
								placeholder="cloudflared access tcp --hostname example.com"
								value={values.proxyCommand}
								onChange={event => onChange('proxyCommand', event.target.value)}
							/>
						)}
					</Field>
				)}
			</div>
		</section>
	);
}
