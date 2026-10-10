import { IconButton } from '@/webview/components/button';
import { Field } from '@/webview/components/field';
import { FolderOpen } from '@/webview/components/icons';
import { Input as TextInput } from '@/webview/components/input';
import { SegmentedControl } from '@/webview/components/segmented-control';
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
				{control => (
					<TextInput
						{...control}
						right={
							<IconButton
								label="Select executable"
								icon={<FolderOpen />}
								onClick={form.selectExecutable}
							/>
						}
						placeholder="docker"
						value={values.executablePath}
						onChange={event => form.update('executablePath', event.target.value)}
					/>
				)}
			</Field>
		</>
	);
}
