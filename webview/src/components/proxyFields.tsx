import { CredentialFields } from './credentialFields';
import { Field } from './ui/field';
import { Input } from './ui/input';
import { Segmented } from './ui/segmented';

export interface ProxyFieldValues {
	proxyCredentialId: string;
	proxyMode: 'none' | 'ssh' | 'command';
	proxyEnabled: boolean;
	proxyCommand: string;
	proxyHost: string;
	proxyPort: string;
	proxyUsername: string;
	proxyAuthType: 'password' | 'privateKey';
}

export interface ProxyFieldsProps {
	values: ProxyFieldValues;
	onChange: <Key extends keyof ProxyFieldValues>(key: Key, value: ProxyFieldValues[Key]) => void;
}

export function ProxyFields({ values, onChange }: ProxyFieldsProps) {
	const updateProxyMode = (mode: ProxyFieldValues['proxyMode']) => {
		onChange('proxyMode', mode);
		onChange('proxyEnabled', mode === 'ssh');
		if (mode === 'none') {
			onChange('proxyCommand', '');
		}
	};
	return (
		<section aria-labelledby="proxy-heading">
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
						<CredentialFields types={['password', 'privateKey']} value={values.proxyCredentialId} onChange={credential => {
							onChange('proxyCredentialId', credential?.id ?? '');
							onChange('proxyUsername', credential?.user ?? '');
							if (credential?.type === 'password' || credential?.type === 'privateKey') onChange('proxyAuthType', credential.type);
						}} />
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
