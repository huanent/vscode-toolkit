import { cn } from 'cn';
import { useState } from 'react';
import { Save } from '../../../components/ui/icons';
import { PrimaryButton } from '../../../components/ui/button';
import { Field } from '../../../components/ui/field';
import { TextInput } from '../../../components/ui/input';
import { AuthenticationFields } from './components/AuthenticationFields';
import { CommandFields } from './components/CommandFields';
import { NetworkFields } from './components/NetworkFields';
import { ProxyFields } from './components/ProxyFields';
import { useServerForm } from './hooks/useServerForm';

export function App() {
	const form = useServerForm();
	const [activeTab, setActiveTab] = useState<'connection' | 'proxy' | 'commands' | 'other'>(
		'connection',
	);
	if (!form.model) {
		return (
			<main className="grid min-h-screen place-items-center text-sm text-(--vscode-descriptionForeground)">
				Loading...
			</main>
		);
	}

	const { model, values } = form;
	const supportsProxy = true;
	const tabs = [
		{ value: 'connection' as const, label: 'Connection' },
		...(supportsProxy ? [{ value: 'proxy' as const, label: 'Proxy' }] : []),
		{ value: 'commands' as const, label: 'Commands' },
		{ value: 'other' as const, label: 'Other' },
	];
	const selectedTab = tabs.some(tab => tab.value === activeTab) ? activeTab : 'connection';

	return (
		<form
			className="min-h-screen"
			onSubmit={event => {
				event.preventDefault();
				form.save();
			}}
		>
			<header className="sticky top-0 z-10 border-b border-(--vscode-panel-border,var(--vscode-widget-border)) bg-(--vscode-editor-background) py-3.5">
				<div className="mx-auto grid w-[min(880px,calc(100%-44px))] grid-cols-[minmax(160px,1.25fr)_minmax(140px,1fr)_auto] items-end gap-3 max-[680px]:w-[calc(100%-28px)] max-[520px]:grid-cols-[minmax(0,1fr)_auto]">
					<Field label="Name" required>
						<TextInput
							autoFocus
							required
							placeholder="Production"
							value={values.name}
							onChange={event => form.update('name', event.target.value)}
						/>
					</Field>
					<Field label="Group" className="max-[520px]:col-start-1 max-[520px]:row-start-2">
						<TextInput
							list="server-groups"
							placeholder="No group"
							value={values.group}
							onChange={event => form.update('group', event.target.value)}
						/>
						<datalist id="server-groups">
							{model.groups.map(group => (
								<option key={group} value={group} />
							))}
						</datalist>
					</Field>
					<PrimaryButton
						className="max-[520px]:col-start-2 max-[520px]:row-span-2 max-[520px]:row-start-1 max-[520px]:self-start"
						type="submit"
						disabled={form.saving}
					>
						<Save size={15} />
						{form.saving ? 'Saving...' : 'Save'}
					</PrimaryButton>
				</div>
			</header>

			<main
				className={cn(
					'mx-auto grid w-[min(880px,calc(100%-44px))] items-start py-8.5 pb-14 max-[680px]:w-[calc(100%-28px)] max-[680px]:pt-5',
					tabs.length > 1
						? 'grid-cols-[148px_minmax(0,1fr)] gap-7 max-[680px]:grid-cols-1 max-[680px]:gap-5'
						: 'grid-cols-[minmax(0,640px)] justify-center',
				)}
			>
				{tabs.length > 1 && (
					<nav
						className="sticky top-24 min-w-0 border-r border-(--vscode-panel-border,var(--vscode-widget-border)) pr-3 max-[680px]:static max-[680px]:overflow-x-auto max-[680px]:border-r-0 max-[680px]:border-b max-[680px]:pr-0"
						aria-label="Server settings"
					>
						<div
							className="flex flex-col gap-0.5 max-[680px]:min-w-max max-[680px]:flex-row"
							role="tablist"
							aria-orientation="vertical"
						>
							{tabs.map(tab => (
								<button
									key={tab.value}
									type="button"
									role="tab"
									aria-selected={selectedTab === tab.value}
									className={cn(
										'relative min-h-9 border-0 bg-transparent px-3 py-2 text-left text-sm max-[680px]:border-b-2 max-[680px]:text-center',
										selectedTab === tab.value
											? 'bg-(--vscode-list-activeSelectionBackground) text-(--vscode-list-activeSelectionForeground) before:absolute before:inset-y-1 before:left-0 before:w-0.5 before:bg-(--vscode-focusBorder) max-[680px]:bg-transparent max-[680px]:text-(--vscode-foreground) max-[680px]:before:inset-x-0 max-[680px]:before:top-auto max-[680px]:before:h-0.5 max-[680px]:before:w-auto'
											: 'text-(--vscode-descriptionForeground) hover:bg-(--vscode-list-hoverBackground) hover:text-(--vscode-foreground) max-[680px]:border-transparent',
									)}
									onClick={() => setActiveTab(tab.value)}
								>
									{tab.label}
								</button>
							))}
						</div>
					</nav>
				)}
				<div className="min-w-0">
					{selectedTab === 'connection' && (
						<section aria-labelledby="connection-heading">
							<h2 className="mt-0 mb-3.5 text-sm font-semibold" id="connection-heading">
								Connection details
							</h2>
							<div className="grid gap-3.5">
								<NetworkFields form={form} />
								<AuthenticationFields form={form} />
							</div>
						</section>
					)}
					{selectedTab === 'proxy' && supportsProxy && <ProxyFields form={form} />}
					{selectedTab === 'commands' && <CommandFields form={form} />}
					{selectedTab === 'other' && (
						<section aria-labelledby="other-heading">
							<h2 className="mt-0 mb-3.5 text-sm font-semibold" id="other-heading">
								Other settings
							</h2>
							<label className="flex items-center justify-between gap-3 border-y border-(--vscode-panel-border,var(--vscode-widget-border)) py-3.5 text-sm">
								<span>Enable AI features</span>
								<input
									type="checkbox"
									checked={values.aiEnabled}
									onChange={event => form.update('aiEnabled', event.target.checked)}
								/>
							</label>
						</section>
					)}
					{form.error && (
						<div
							className="mt-4 border-l-[3px] border-(--vscode-errorForeground) bg-(--vscode-inputValidation-errorBackground) px-3 py-2.5 text-(--vscode-errorForeground)"
							role="alert"
						>
							{form.error}
						</div>
					)}
				</div>
			</main>
		</form>
	);
}
