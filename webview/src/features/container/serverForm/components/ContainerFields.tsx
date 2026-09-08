import { IconButton } from '../../../../components/ui/button';
import { Field } from '../../../../components/ui/field';
import { FolderOpen } from '../../../../components/ui/icons';
import { TextInput } from '../../../../components/ui/input';
import { SegmentedControl } from '../../../../components/ui/segmentedControl';
import type { ServerFormState } from '../hooks/useServerForm';

const runtimeDefaults = {
	docker: 'docker',
	podman: 'podman',
	apple: '/opt/homebrew/bin/container',
} as const;

export function ContainerFields({ form }: { form: ServerFormState }) {
	const { values } = form;
	return (
		<>
			<SegmentedControl
				label="Container runtime"
				value={values.runtime}
				options={[
					{ value: 'docker', label: 'Docker' },
					{ value: 'podman', label: 'Podman' },
					{ value: 'apple', label: 'Apple' },
				]}
				onChange={value => {
					form.update('runtime', value);
					form.update('executablePath', runtimeDefaults[value]);
				}}
			/>
			<Field label="Executable" required>
				<span className="input-action-group flex">
					<TextInput
						className="min-w-0 border-r-0"
						required
						placeholder="docker"
						value={values.executablePath}
						onChange={event => form.update('executablePath', event.target.value)}
					/>
					<IconButton
						className="input-action-button"
						type="button"
						title="Select executable"
						aria-label="Select executable"
						onClick={form.selectExecutable}
					>
						<FolderOpen size={16} />
					</IconButton>
				</span>
			</Field>
		</>
	);
}
