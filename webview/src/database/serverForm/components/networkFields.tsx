import { Field } from '../../../components/ui/field';
import { Input } from '../../../components/ui/input';
import type { ServerFormState } from '../hooks/useServerForm';

export function NetworkFields({ form }: { form: ServerFormState }) {
	const { values }=form;
	return (
		<>
			<div className="grid grid-cols-[minmax(0,1fr)_112px] gap-3 max-[440px]:grid-cols-1">
				<Field label="Host" required>
					{control => <Input
						{...control}
						required
						placeholder="server.example.com"
						value={values.host}
						onChange={event => form.update('host', event.target.value)}
					/>}
				</Field>
				<Field label="Port" required>
					{control => <Input
						{...control}
						required
						type="number"
						min={1}
						max={65535}
						value={values.port}
						onChange={event => form.update('port', event.target.value)}
					/>}
				</Field>
			</div>

			<Field label="Database" required>
				{control => <Input
					{...control}
					required
					placeholder="app"
					value={values.database}
					onChange={event => form.update('database', event.target.value)}
				/>}
			</Field>
		</>
	);
}
