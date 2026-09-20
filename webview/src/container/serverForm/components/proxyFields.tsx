import { CredentialFields } from '@webview/components/credentialFields';
import { Field } from '@webview/components/ui/field';
import { Input as TextInput } from '@webview/components/ui/input';
import { Segmented as SegmentedControl } from '@webview/components/ui/segmented';
import type { ServerFormState } from '../hooks/useServerForm';

export function ProxyFields({ form }: { form: ServerFormState }) {
	const { values } = form;
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
		| 'proxyCredentialId',
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
						<CredentialFields types={['password', 'privateKey']} value={values.proxyCredentialId} disabled={form.saving} onChange={credential => {
							updateProxy('proxyCredentialId', credential?.id ?? '');
						}} />
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
