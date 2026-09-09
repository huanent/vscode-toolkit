import { Field } from '../../../../components/field';
import { TextInput } from '../../../../components/input';
import type { ServerFormState } from '../hooks/useServerForm';

export function NetworkFields({ form }: { form: ServerFormState }) {
	const { values } = form;
	return (
		<>
			<div className="grid grid-cols-[minmax(0,1fr)_112px] gap-3 max-[440px]:grid-cols-1">
				<Field label="Host" required>
					<TextInput
						required
						placeholder="server.example.com"
						value={values.host}
						onChange={event => form.update('host', event.target.value)}
					/>
				</Field>
				<Field label="Port" required>
					<TextInput
						required
						type="number"
						min={1}
						max={65535}
						value={values.port}
						onChange={event => form.update('port', event.target.value)}
					/>
				</Field>
			</div>
			<Field label="Username" required>
				<TextInput
					required
					autoComplete="username"
					placeholder="root"
					value={values.username}
					onChange={event => form.update('username', event.target.value)}
				/>
			</Field>

			<Field label="Database" required>
				<TextInput
					required
					placeholder="app"
					value={values.database}
					onChange={event => form.update('database', event.target.value)}
				/>
			</Field>
		</>
	);
}
