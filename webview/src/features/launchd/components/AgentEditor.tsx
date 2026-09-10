import { cn } from 'cn';
import { LoaderCircle, Save } from '../../../components/icons';
import { FieldLabel, PrimaryButton, TextArea, TextInput } from '../../../components';
import type { LaunchAgentConfig } from '../types';

export function AgentEditor({
	draft,
	argumentsText,
	environmentText,
	busy,
	onArgumentsChange,
	onEnvironmentChange,
	onUpdate,
	onSave,
}: {
	draft: LaunchAgentConfig;
	argumentsText: string;
	environmentText: string;
	busy: boolean;
	onArgumentsChange(value: string): void;
	onEnvironmentChange(value: string): void;
	onUpdate<Key extends keyof LaunchAgentConfig>(key: Key, value: LaunchAgentConfig[Key]): void;
	onSave(): void;
}) {
	return (
		<section
			className="min-w-0 bg-(--vscode-editor-background)"
			aria-label="LaunchAgent configuration"
		>
			<div className="flex min-h-16 flex-wrap items-center justify-between gap-4 border-b border-b-(--vscode-panel-border) bg-(--vscode-editorWidget-background) px-4 py-3">
				<div className="min-w-0">
					<Eyebrow>{draft.fileName ? 'Edit agent' : 'New agent'}</Eyebrow>
					<h2 className="m-0 text-lg font-semibold wrap-anywhere">
						{draft.label || 'Untitled LaunchAgent'}
					</h2>
				</div>
				<PrimaryButton type="button" disabled={busy} onClick={onSave}>
					{busy ? <LoaderCircle className="codicon-modifier-spin" size={16} /> : <Save size={16} />}Save
				</PrimaryButton>
			</div>
			<div className="grid grid-cols-2 gap-4 p-4 max-[760px]:grid-cols-1">
				<FormField className="col-span-2 max-[760px]:col-auto" label="Label">
					<TextInput
						value={draft.label}
						onChange={event => onUpdate('label', event.target.value)}
						placeholder="com.example.worker"
						spellCheck={false}
					/>
				</FormField>
				<FormField className="col-span-2 max-[760px]:col-auto" label="Program">
					<TextInput
						value={draft.program}
						onChange={event => onUpdate('program', event.target.value)}
						placeholder="/usr/local/bin/node"
						spellCheck={false}
					/>
				</FormField>
				<FormField
					className="col-span-2 max-[760px]:col-auto"
					label="Program arguments"
					hint="one per line"
				>
					<TextArea
						value={argumentsText}
						onChange={event => onArgumentsChange(event.target.value)}
						placeholder={'/path/to/script.js\n--production'}
						spellCheck={false}
					/>
				</FormField>
				<FormField className="col-span-2 max-[760px]:col-auto" label="Working directory">
					<TextInput
						value={draft.workingDirectory}
						onChange={event => onUpdate('workingDirectory', event.target.value)}
						placeholder="/Users/me/project"
						spellCheck={false}
					/>
				</FormField>
				<ToggleField
					label="Run at load"
					description="Start immediately after loading"
					checked={draft.runAtLoad}
					onChange={value => onUpdate('runAtLoad', value)}
				/>
				<ToggleField
					label="Keep alive"
					description="Restart after the process exits"
					checked={draft.keepAlive}
					onChange={value => onUpdate('keepAlive', value)}
				/>
				<FormField label="Throttle interval" hint="seconds">
					<TextInput
						type="number"
						min="0"
						step="1"
						value={draft.throttleInterval}
						onChange={event => onUpdate('throttleInterval', Number(event.target.value))}
					/>
				</FormField>
				<div className="max-[760px]:hidden" />
				<FormField
					className="col-span-2 max-[760px]:col-auto"
					label="Environment variables"
					hint="KEY=value, one per line"
				>
					<TextArea
						value={environmentText}
						onChange={event => onEnvironmentChange(event.target.value)}
						placeholder={'NODE_ENV=production\nPORT=3000'}
						spellCheck={false}
					/>
				</FormField>
				<FormField label="Standard output path">
					<TextInput
						value={draft.standardOutPath}
						onChange={event => onUpdate('standardOutPath', event.target.value)}
						placeholder="/tmp/worker.log"
						spellCheck={false}
					/>
				</FormField>
				<FormField label="Standard error path">
					<TextInput
						value={draft.standardErrorPath}
						onChange={event => onUpdate('standardErrorPath', event.target.value)}
						placeholder="/tmp/worker.error.log"
						spellCheck={false}
					/>
				</FormField>
			</div>
		</section>
	);
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
	return (
		<span className="mb-1 block text-xs font-medium text-(--vscode-descriptionForeground)">
			{children}
		</span>
	);
}

function FormField({
	className = '',
	label,
	hint,
	children,
}: {
	className?: string;
	label: string;
	hint?: string;
	children: React.ReactNode;
}) {
	return (
		<label className={cn('min-w-0', className)}>
			<FieldLabel hint={hint}>{label}</FieldLabel>
			{children}
		</label>
	);
}

function ToggleField({
	label,
	description,
	checked,
	onChange,
}: {
	label: string;
	description: string;
	checked: boolean;
	onChange(value: boolean): void;
}) {
	return (
		<label className="group flex min-h-14 items-center justify-between gap-4 rounded-xs border border-(--vscode-panel-border) bg-(--vscode-editorWidget-background) p-3 hover:border-(--vscode-focusBorder)">
			<span className="min-w-0 wrap-anywhere">
				<strong className="block text-sm font-medium">{label}</strong>
				<small className="mt-1 block text-xs text-(--vscode-descriptionForeground)">
					{description}
				</small>
			</span>
			<span
				className={cn(
					'relative h-4.5 w-8 shrink-0 rounded-full border transition-colors duration-100',
					checked
						? 'border-(--vscode-button-background) bg-(--vscode-button-background)'
						: 'border-(--vscode-checkbox-border,var(--vscode-panel-border)) bg-(--vscode-checkbox-background)',
				)}
			>
				<span
					className={cn(
						'absolute top-0.5 size-3 rounded-full bg-(--vscode-button-foreground) shadow-sm transition-[left] duration-100',
						checked ? 'left-4' : 'left-0.5',
					)}
				/>
			</span>
			<input
				className="sr-only"
				type="checkbox"
				role="switch"
				checked={checked}
				onChange={event => onChange(event.target.checked)}
			/>
		</label>
	);
}
