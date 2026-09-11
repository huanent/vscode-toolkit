import { cn } from 'cn';
import { LoaderCircle, RotateCw, X } from '../../../components/icons';
import { IconButton, PrimaryButton, SecondaryButton } from '../../../components/button';
import { FieldLabel } from '../../../components/field';
import { SelectInput, TextArea, TextInput } from '../../../components/input';
import type { useContainerEditor } from './hooks/useContainerEditor';
import { Message } from './Message';

type EditorState = Pick<
	ReturnType<typeof useContainerEditor>,
	| 'containerEditor'
	| 'server'
	| 'closeContainerEditor'
	| 'recreateContainer'
	| 'updateContainerConfig'
>;

export function ContainerEditDialog({ editor }: { editor: EditorState }) {
	const state = editor.containerEditor!;
	const config = state.config;
	return (
		<div
			className="fixed inset-0 z-30 grid place-items-center bg-black/45 p-4"
			onMouseDown={event => {
				if (event.target === event.currentTarget) editor.closeContainerEditor();
			}}
		>
			<form
				className="grid h-[min(780px,100%)] w-[min(760px,100%)] min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-lg border border-(--vscode-panel-border,var(--vscode-widget-border)) bg-(--vscode-editor-background) shadow-[0_4px_16px_var(--vscode-widget-shadow)]"
				role="dialog"
				aria-modal="true"
				aria-labelledby="container-edit-title"
				onSubmit={event => {
					event.preventDefault();
					editor.recreateContainer();
				}}
			>
				<header className="flex min-h-12 min-w-0 items-center gap-3 border-b border-(--vscode-panel-border,var(--vscode-widget-border)) px-4 py-2">
					<h2 id="container-edit-title" className="m-0 min-w-0 text-lg font-semibold wrap-anywhere">
						Edit and recreate container
					</h2>
					<IconButton
						className="ml-auto border-0"
						type="button"
						disabled={state.saving}
						title="Close"
						onClick={editor.closeContainerEditor}
					>
						<X size={16} />
					</IconButton>
				</header>
				<div className="min-h-0 overflow-auto p-4">
					{state.loading ? (
						<Message>
							<LoaderCircle className="animate-spin" size={18} />
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
				</div>
				<footer className="flex flex-wrap items-center justify-end gap-2 border-t border-(--vscode-panel-border,var(--vscode-widget-border)) px-4 py-3">
					<SecondaryButton
						type="button"
						disabled={state.saving}
						onClick={editor.closeContainerEditor}
					>
						Cancel
					</SecondaryButton>
					<PrimaryButton type="submit" disabled={!config || state.loading || state.saving}>
						<RotateCw className={cn(state.saving ? 'animate-spin' : '')} size={15} />
						{state.saving ? 'Recreating...' : 'Recreate'}
					</PrimaryButton>
				</footer>
			</form>
		</div>
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
			<FieldLabel hint={hint}>
				{label}
				{required && <span className="ml-1 text-(--vscode-errorForeground)">*</span>}
			</FieldLabel>
			{children}
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
