import { Field } from '../../../../components/ui/field';
import { Input } from '../../../../components/ui/input';
import type { ConnectionFormState } from '../hooks/useConnectionForm';

export function NetworkFields({ form }: { form: ConnectionFormState }) {
	const { values } = form;
	return (
		<>
			<div className="grid grid-cols-[minmax(0,1fr)_112px] gap-3 max-[440px]:grid-cols-1">
				<Field label="Host" required>
					{control => (
						<>
							<Input
								{...control}
								required
								placeholder="server.example.com"
								value={values.host}
								onChange={event => form.update('host', event.target.value)}
							/>
						</>
					)}
				</Field>
				<Field label="Port" required>
					{control => (
						<>
							<Input
								{...control}
								required
								type="number"
								min={1}
								max={65535}
								value={values.port}
								onChange={event => form.update('port', event.target.value)}
							/>
						</>
					)}
				</Field>
			</div>
			<Field label="Username" required>
				{control => (
					<>
						<Input
							{...control}
							required
							autoComplete="username"
							placeholder="root"
							value={values.username}
							onChange={event => form.update('username', event.target.value)}
						/>
					</>
				)}
			</Field>
		</>
	);
}
