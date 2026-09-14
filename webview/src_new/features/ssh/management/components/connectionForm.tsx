import { cn } from 'cn';
import { StorageLocation } from '../../../../components/storageLocation';
import { useState } from 'react';
import { Save } from '../../../../components/ui/icons';
import { Button } from '../../../../components/ui/button';
import { Field } from '../../../../components/ui/field';
import { Input } from '../../../../components/ui/input';
import { AuthenticationFields } from './authenticationFields';
import { CommandFields } from './commandFields';
import { NetworkFields } from './networkFields';
import { ProxyFields } from '../../../../components/proxyFields';
import type { ConnectionFormState } from '../hooks/useConnectionForm';

export function ConnectionForm({ form }: { form: ConnectionFormState }) {
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
			onSubmit={event => {
				event.preventDefault();
				form.save();
			}}
		>
			<header className="sticky top-0 z-10 border-b border-(--vscode-panel-border,var(--vscode-widget-border)) bg-(--vscode-editor-background) py-3.5">
				<StorageLocation
					value={values.location}
					folders={model.workspaceFolders ?? []}
					disabled={form.saving || model.locationLocked}
					onChange={value => form.update('location', value)}
				/>
				<div className="mx-auto grid w-[min(880px,calc(100%-44px))] grid-cols-[minmax(160px,1.25fr)_minmax(140px,1fr)_auto] items-end gap-3 max-[680px]:w-[calc(100%-28px)] max-[520px]:grid-cols-[minmax(0,1fr)_auto]">
					<Field label="Name" required>
						{control => (
							<>
								<Input
									{...control}
									autoFocus
									required
									placeholder="Production"
									value={values.name}
									onChange={event => form.update('name', event.target.value)}
								/>
							</>
						)}
					</Field>
					<Field label="Group" className="max-[520px]:col-start-1 max-[520px]:row-start-2">
						{control => (
							<>
								<Input
									{...control}
									list="connection-groups"
									placeholder="No group"
									value={values.group}
									onChange={event => form.update('group', event.target.value)}
								/>
								<datalist id="connection-groups">
									{model.groups.map(group => (
										<option key={group} value={group} />
									))}
								</datalist>
							</>
						)}
					</Field>
					<Button
						left={<Save size="md" />}
						className="max-[520px]:col-start-2 max-[520px]:row-span-2 max-[520px]:row-start-1 max-[520px]:self-start"
						htmlType="submit"
						disabled={form.saving}
					>
						{form.saving ? 'Saving...' : 'Save'}
					</Button>
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
						aria-label="Connection settings"
					>
						<div
							className="flex flex-col gap-0.5 max-[680px]:min-w-max max-[680px]:flex-row"
							role="tablist"
							aria-orientation="vertical"
						>
							{tabs.map(tab => (
								<Button
									key={tab.value}
									variant="text"
									active={selectedTab === tab.value}
									role="tab"
									aria-selected={selectedTab === tab.value}
									className="justify-start max-[680px]:justify-center"
									onClick={() => setActiveTab(tab.value)}
								>
									{tab.label}
								</Button>
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
					{selectedTab === 'proxy' && supportsProxy && (
						<ProxyFields
							values={form.values}
							onChange={(key, value) => form.update<keyof typeof form.values>(key, value)}
							onSelectPrivateKey={form.selectProxyPrivateKey}
						/>
					)}
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
