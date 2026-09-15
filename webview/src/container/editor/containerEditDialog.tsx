import { cn } from 'cn';
import { useId } from 'react';
import { Dialog } from '@webview/components/ui/dialog';
import { LoaderCircle, RotateCw } from '@webview/components/ui/icons';
import { Button as PrimaryButton, Button as SecondaryButton } from '@webview/components/ui/button';
import { FieldLabel } from '@webview/components/ui/field';
import { Select as SelectInput, Textarea as TextArea, Input as TextInput } from '@webview/components/ui/input';
import type { useContainerEditor } from './hooks/useContainerEditor';
import { Message } from './message';

type EditorState = Pick<
	ReturnType<typeof useContainerEditor>,
	| 'containerEditor'
	| 'server'
	| 'closeContainerEditor'
	| 'recreateContainer'
	| 'updateContainerConfig'
>;

export function ContainerEditDialog({ editor }: { editor: EditorState }) {
	const formId = useId();
	const state = editor.containerEditor!;
	const config = state.config;
	return (
		<Dialog
			open
			size="lg"
			title="Edit and recreate container"
			onClose={editor.closeContainerEditor}
			closeDisabled={state.saving}
			actions={<>
				<SecondaryButton variant="plain" disabled={state.saving} onClick={editor.closeContainerEditor}>Cancel</SecondaryButton>
				<PrimaryButton htmlType="submit" form={formId} disabled={!config || state.loading || state.saving} left={<RotateCw className={state.saving ? 'animate-spin' : ''} />}>
					{state.saving ? 'Recreating...' : 'Recreate'}
				</PrimaryButton>
			</>}
		>
			<form
				id={formId}
				onSubmit={event => {
					event.preventDefault();
					editor.recreateContainer();
				}}
			>
				{state.loading ? (
					<Message>
						<LoaderCircle className="animate-spin" size="lg" />
						Loading configuration...
					</Message>
				) : config ? (
					<div className="grid gap-4">
						<div className="grid grid-cols-2 gap-3 max-[560px]:grid-cols-1">
							<EditField label="Name" required>
								<TextInput
									autoFocus
									required
									disabled={state.saving}
									value={config.name}
									onChange={event => editor.updateContainerConfig('name', event.target.value)}
								/>
							</EditField>
							<EditField label="Image" required>
								<TextInput
									required
									disabled={state.saving}
									value={config.image}
									onChange={event => editor.updateContainerConfig('image', event.target.value)}
								/>
							</EditField>
						</div>
						<div className="grid grid-cols-2 gap-3 max-[560px]:grid-cols-1">
							<EditField label="Entrypoint">
								<TextInput
									disabled={state.saving}
									value={config.entrypoint}
									onChange={event =>
										editor.updateContainerConfig('entrypoint', event.target.value)
									}
								/>
							</EditField>
							<EditField label="User">
								<TextInput
									disabled={state.saving}
									value={config.user}
									onChange={event => editor.updateContainerConfig('user', event.target.value)}
								/>
							</EditField>
						</div>
						<div className="grid grid-cols-2 gap-3 max-[560px]:grid-cols-1">
							<EditField label="Working directory">
								<TextInput
									disabled={state.saving}
									value={config.workingDirectory}
									onChange={event =>
										editor.updateContainerConfig('workingDirectory', event.target.value)
									}
								/>
							</EditField>
							<EditField label="Restart policy">
								<SelectInput
									disabled={state.saving || editor.server?.runtime === 'apple'}
									value={config.restartPolicy}
									onChange={event =>
										editor.updateContainerConfig('restartPolicy', event.target.value)
									}
								>
									<option value="">None</option>
									<option value="no">No</option>
									<option value="always">Always</option>
									<option value="unless-stopped">Unless stopped</option>
									<option value="on-failure">On failure</option>
								</SelectInput>
							</EditField>
						</div>
						<EditField label="Command" hint="one argument per line">
							<TextArea
								className="min-h-24"
								disabled={state.saving}
								value={config.command}
								onChange={event => editor.updateContainerConfig('command', event.target.value)}
							/>
						</EditField>
						<div className="grid grid-cols-2 gap-3 max-[560px]:grid-cols-1">
							<EditField label="Environment" hint="KEY=value, one per line">
								<TextArea
									disabled={state.saving}
									value={config.environment}
									onChange={event =>
										editor.updateContainerConfig('environment', event.target.value)
									}
								/>
							</EditField>
							<EditField label="Published ports" hint="host:container, one per line">
								<TextArea
									disabled={state.saving}
									value={config.ports}
									onChange={event => editor.updateContainerConfig('ports', event.target.value)}
								/>
							</EditField>
						</div>
						{editor.server?.runtime === 'apple' && (
							<EditField label="Published sockets" hint="host_path:container_path, one per line">
								<TextArea
									className="min-h-20"
									disabled={state.saving}
									value={config.sockets}
									onChange={event => editor.updateContainerConfig('sockets', event.target.value)}
								/>
							</EditField>
						)}
						<EditSection title="Storage and network">
							<EditField label="Networks" hint="name[,mac=...][,mtu=...], one per line">
								<TextArea
									className="min-h-24"
									disabled={state.saving}
									value={config.networks}
									onChange={event => editor.updateContainerConfig('networks', event.target.value)}
								/>
							</EditField>
							<div className="grid grid-cols-2 gap-3 max-[560px]:grid-cols-1">
								<EditField label="Volumes" hint="source:target, one per line">
									<TextArea
										disabled={state.saving}
										value={config.volumes}
										onChange={event =>
											editor.updateContainerConfig('volumes', event.target.value)
										}
									/>
								</EditField>
								<EditField label="Mounts" hint="type=...,source=...,target=...">
									<TextArea
										disabled={state.saving}
										value={config.mounts}
										onChange={event => editor.updateContainerConfig('mounts', event.target.value)}
									/>
								</EditField>
							</div>
							<EditField label="Tmpfs" hint="target[:options], one per line">
								<TextArea
									className="min-h-20"
									disabled={state.saving}
									value={config.tmpfs}
									onChange={event => editor.updateContainerConfig('tmpfs', event.target.value)}
								/>
							</EditField>
						</EditSection>
						<EditSection title="Runtime">
							<div className="grid grid-cols-3 gap-3 max-[640px]:grid-cols-1">
								<EditField label="CPUs">
									<TextInput
										disabled={state.saving}
										value={config.cpus}
										onChange={event => editor.updateContainerConfig('cpus', event.target.value)}
									/>
								</EditField>
								<EditField label="Memory" hint="bytes or 1G">
									<TextInput
										disabled={state.saving}
										value={config.memory}
										onChange={event => editor.updateContainerConfig('memory', event.target.value)}
									/>
								</EditField>
								<EditField label="Shared memory">
									<TextInput
										disabled={state.saving}
										value={config.shmSize}
										onChange={event =>
											editor.updateContainerConfig('shmSize', event.target.value)
										}
									/>
								</EditField>
							</div>
							<div className="grid grid-cols-2 gap-3 max-[560px]:grid-cols-1">
								<EditField label="Platform">
									<TextInput
										disabled={state.saving}
										value={config.platform}
										onChange={event =>
											editor.updateContainerConfig('platform', event.target.value)
										}
									/>
								</EditField>
								<EditField label="Runtime handler">
									<TextInput
										disabled={state.saving}
										value={config.runtime}
										onChange={event =>
											editor.updateContainerConfig('runtime', event.target.value)
										}
									/>
								</EditField>
							</div>
							<div className="flex flex-wrap gap-x-5 gap-y-2">
								{(
									[
										['interactive', 'Interactive'],
										['tty', 'TTY'],
										['readOnly', 'Read only'],
										['init', 'Init'],
										['rosetta', 'Rosetta'],
										['ssh', 'SSH forwarding'],
										['virtualization', 'Virtualization'],
									] as const
								).map(([key, label]) => (
									<label
										key={key}
										className={cn(
											'inline-flex items-center gap-2 text-xs',
											editor.server?.runtime !== 'apple' &&
												(key === 'rosetta' || key === 'ssh' || key === 'virtualization')
												? 'hidden'
												: '',
										)}
									>
										<input
											type="checkbox"
											disabled={state.saving}
											checked={config[key]}
											onChange={event => editor.updateContainerConfig(key, event.target.checked)}
										/>
										{label}
									</label>
								))}
							</div>
						</EditSection>
						<EditSection title="Security and metadata">
							<div className="grid grid-cols-2 gap-3 max-[560px]:grid-cols-1">
								<EditField label="Capabilities added" hint="one per line">
									<TextArea
										className="min-h-20"
										disabled={state.saving}
										value={config.capAdd}
										onChange={event => editor.updateContainerConfig('capAdd', event.target.value)}
									/>
								</EditField>
								<EditField label="Capabilities dropped" hint="one per line">
									<TextArea
										className="min-h-20"
										disabled={state.saving}
										value={config.capDrop}
										onChange={event =>
											editor.updateContainerConfig('capDrop', event.target.value)
										}
									/>
								</EditField>
							</div>
							<div className="grid grid-cols-2 gap-3 max-[560px]:grid-cols-1">
								<EditField label="Labels" hint="KEY=value, one per line">
									<TextArea
										disabled={state.saving}
										value={config.labels}
										onChange={event => editor.updateContainerConfig('labels', event.target.value)}
									/>
								</EditField>
								<EditField label="Ulimits" hint="type=soft[:hard], one per line">
									<TextArea
										disabled={state.saving}
										value={config.ulimits}
										onChange={event =>
											editor.updateContainerConfig('ulimits', event.target.value)
										}
									/>
								</EditField>
							</div>
						</EditSection>
						<EditSection title="DNS">
							<div className="grid grid-cols-3 gap-3 max-[640px]:grid-cols-1">
								<EditField label="Servers" hint="one per line">
									<TextArea
										className="min-h-20"
										disabled={state.saving}
										value={config.dnsServers}
										onChange={event =>
											editor.updateContainerConfig('dnsServers', event.target.value)
										}
									/>
								</EditField>
								<EditField label="Search domains" hint="one per line">
									<TextArea
										className="min-h-20"
										disabled={state.saving}
										value={config.dnsSearch}
										onChange={event =>
											editor.updateContainerConfig('dnsSearch', event.target.value)
										}
									/>
								</EditField>
								<EditField label="Options" hint="one per line">
									<TextArea
										className="min-h-20"
										disabled={state.saving}
										value={config.dnsOptions}
										onChange={event =>
											editor.updateContainerConfig('dnsOptions', event.target.value)
										}
									/>
								</EditField>
							</div>
						</EditSection>
					</div>
				) : null}
				{state.error && (
					<div
						className="mt-4 border-l-[3px] border-(--vscode-errorForeground) bg-(--vscode-inputValidation-errorBackground) px-3 py-2.5 text-(--vscode-errorForeground)"
						role="alert"
					>
						{state.error}
					</div>
				)}
			</form>
		</Dialog>
	);
}

function EditField({
	label,
	hint,
	required,
	children,
}: {
	label: string;
	hint?: string;
	required?: boolean;
	children: React.ReactNode;
}) {
	return (
		<label className="block min-w-0">
			<FieldLabel>
				{label}
				{required && <span className="ml-1 text-(--vscode-errorForeground)">*</span>}
			</FieldLabel>
			{children}
			{hint && <span className="text-xs text-(--vscode-descriptionForeground)">{hint}</span>}
		</label>
	);
}

function EditSection({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<section className="grid gap-4 border-t border-(--vscode-panel-border,var(--vscode-widget-border)) pt-4">
			<h3 className="m-0 text-sm font-semibold text-(--vscode-descriptionForeground)">{title}</h3>
			{children}
		</section>
	);
}
