import { useEffect, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import {
	ArrowDown,
	ArrowUp,
	Copy,
	Download,
	Pencil,
	Play,
	Plus,
	RefreshCw,
	Search,
	Trash2,
	Upload,
	Database,
	MoreHorizontal,
} from 'lucide-react';
import { vscode } from '../../../vscodeApi';

interface Connection {
	id: string;
	name: string;
	group: string;
	address: string;
	kind: string;
}
const send = (type: string, id?: string) => vscode.postMessage({ type, id });

function Action({
	label,
	onClick,
	children,
	disabled = false,
}: {
	label: string;
	onClick: () => void;
	children: ReactNode;
	disabled?: boolean;
}) {
	return (
		<button type="button" title={label} aria-label={label} disabled={disabled} onClick={onClick}>
			{children}
		</button>
	);
}

function App() {
	const [state, setState] = useState<{ name: string; servers: Connection[] }>();
	const [query, setQuery] = useState('');
	const [menu, setMenu] = useState<string>();
	useEffect(() => {
		const dismiss = () => setMenu(undefined);
		const escape = (event: KeyboardEvent) => {
			if (event.key === 'Escape') dismiss();
		};
		window.addEventListener('click', dismiss);
		window.addEventListener('keydown', escape);
		return () => {
			window.removeEventListener('click', dismiss);
			window.removeEventListener('keydown', escape);
		};
	}, []);
	const FeatureIcon = Database;
	useEffect(() => {
		const receive = (event: MessageEvent) => {
			if (event.data.type === 'state') {
				setState(event.data);
			}
		};
		window.addEventListener('message', receive);
		send('ready');
		return () => window.removeEventListener('message', receive);
	}, []);
	const servers =
		state?.servers.filter(server =>
			`${server.name} ${server.group} ${server.address} ${server.kind}`
				.toLowerCase()
				.includes(query.toLowerCase()),
		) ?? [];
	return (
		<main className="mx-auto max-w-[1280px] px-8 py-7 text-(--vscode-foreground) max-[600px]:p-3 [&_svg]:shrink-0 [&_button]:inline-flex [&_button]:min-h-[30px] [&_button]:min-w-[30px] [&_button]:items-center [&_button]:justify-center [&_button]:gap-1.5 [&_button]:rounded-[3px] [&_button]:border [&_button]:border-transparent [&_button]:p-[5px] [&_button:hover]:bg-(--vscode-toolbar-hoverBackground) [&_button:disabled]:cursor-default [&_button:disabled]:opacity-40">
			<header className="mb-6 flex flex-wrap items-center gap-3">
				<span className="inline-flex size-[38px] shrink-0 items-center justify-center rounded-md bg-[color-mix(in_srgb,var(--vscode-textLink-foreground)_9%,transparent)] text-(--vscode-textLink-foreground)">
					<FeatureIcon size={21} strokeWidth={1.6} />
				</span>
				<h1 className="m-0 text-xl font-semibold tracking-normal">
					{state?.name ?? 'Connections'}
				</h1>
				<span className="rounded-sm bg-(--vscode-badge-background) px-1.5 py-px text-xs text-(--vscode-badge-foreground)">
					{state?.servers.length ?? 0}
				</span>
				<div className="ml-auto flex flex-nowrap items-center gap-1 max-[600px]:ml-0 max-[600px]:w-full">
					<Action label="Import connections" onClick={() => send('import')}>
						<Upload size={16} />
					</Action>
					<Action
						label="Export connections"
						disabled={!state?.servers.length}
						onClick={() => send('exportAll')}
					>
						<Download size={16} />
					</Action>
					<Action label="Refresh" onClick={() => send('refresh')}>
						<RefreshCw size={16} />
					</Action>
					<button
						className="bg-(--vscode-button-background) px-2.5! text-(--vscode-button-foreground) hover:bg-(--vscode-button-hoverBackground)!"
						onClick={() => send('add')}
					>
						<Plus size={16} />
						New connection
					</button>
				</div>
			</header>
			<div className="flex items-center justify-between gap-4 pb-4">
				<label className="flex min-h-8 w-[min(380px,100%)] items-center gap-2 rounded-md border border-(--vscode-input-border,transparent) bg-(--vscode-input-background) px-2 py-1 text-sm focus-within:outline focus-within:outline-(--vscode-focusBorder)">
					<Search size={16} />
					<input
						className="min-w-0 w-full border-0 bg-transparent text-(--vscode-input-foreground) outline-none"
						aria-label="Search connections"
						placeholder="Search connections"
						value={query}
						onChange={event => setQuery(event.target.value)}
					/>
				</label>
				<span className="text-xs whitespace-nowrap text-(--vscode-descriptionForeground) max-[600px]:hidden">
					{servers.length} connections
				</span>
			</div>
			{!state ? (
				<p role="status">Loading...</p>
			) : servers.length === 0 ? (
				<div
					className="flex min-h-[240px] flex-col items-center justify-center gap-3 text-(--vscode-descriptionForeground) [&_p]:m-0"
					role="status"
				>
					<FeatureIcon size={32} strokeWidth={1.2} />
					<p>{query ? 'No matching connections.' : 'No connections yet.'}</p>
					<button onClick={() => (query ? setQuery('') : send('add'))}>
						{query ? 'Clear search' : 'New connection'}
					</button>
				</div>
			) : (
				<div className="overflow-x-auto pb-64 [contain:inline-size_layout] [&_table]:min-w-160">
					<table className="w-full border-collapse text-left text-sm [&_td]:max-w-80 [&_td]:border-b [&_td]:border-(--vscode-panel-border) [&_td]:px-3 [&_td]:py-3 [&_td]:wrap-anywhere [&_th]:max-w-80 [&_th]:border-b [&_th]:border-(--vscode-panel-border) [&_th]:bg-[color-mix(in_srgb,var(--vscode-foreground)_3%,transparent)] [&_th]:px-3 [&_th]:py-2 [&_th]:text-xs [&_th]:font-medium [&_th]:text-(--vscode-descriptionForeground) [&_th]:wrap-anywhere [&_td:last-child]:w-28 [&_td:last-child]:min-w-28 max-[600px]:[&_td]:px-2 max-[600px]:[&_td]:py-2 max-[600px]:[&_th]:px-2">
						<thead>
							<tr>
								<th>Name</th>
								<th>Address</th>
								<th>Group</th>
								<th className="max-[600px]:hidden">Type</th>
								<th>
									<span className="sr-only">Actions</span>
								</th>
							</tr>
						</thead>
						<tbody>
							{servers.map(server => (
								<tr key={server.id} className="hover:bg-(--vscode-list-hoverBackground)">
									<td>
										<div className="flex items-center gap-2.5">
											<span className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-[color-mix(in_srgb,var(--vscode-textLink-foreground)_9%,transparent)] text-(--vscode-textLink-foreground) max-[600px]:hidden">
												<FeatureIcon size={17} strokeWidth={1.5} />
											</span>
											<button
												className="justify-start! text-left font-semibold wrap-anywhere text-(--vscode-foreground)"
												onClick={() => send('connect', server.id)}
											>
												{server.name}
											</button>
										</div>
									</td>
									<td className="font-[family-name:var(--vscode-editor-font-family)] text-xs text-(--vscode-descriptionForeground)">
										{server.address}
									</td>
									<td>
										<span className="text-xs">{server.group || 'Ungrouped'}</span>
									</td>
									<td className="text-xs text-(--vscode-descriptionForeground) max-[600px]:hidden">
										{server.kind}
									</td>
									<td>
										<div className="flex flex-nowrap items-center gap-1">
											<Action
												label={`Connect ${server.name}`}
												onClick={() => send('connect', server.id)}
											>
												<Play size={15} />
											</Action>
											<Action label={`Edit ${server.name}`} onClick={() => send('edit', server.id)}>
												<Pencil size={15} />
											</Action>
											<div className="relative">
												<button
													aria-label={`More actions for ${server.name}`}
													title="More actions"
													aria-expanded={menu === server.id}
													onClick={event => {
														event.stopPropagation();
														setMenu(menu === server.id ? undefined : server.id);
													}}
												>
													<MoreHorizontal size={17} />
												</button>
												{menu === server.id && (
													<div className="absolute top-[34px] right-0 z-10 w-[164px] rounded-[5px] border border-(--vscode-menu-border,var(--vscode-panel-border)) bg-(--vscode-menu-background,var(--vscode-editor-background)) p-1 text-(--vscode-menu-foreground,var(--vscode-foreground)) shadow-[0_4px_16px_var(--vscode-widget-shadow)] [&_button]:flex [&_button]:w-full [&_button]:justify-start [&_button]:gap-2.5 [&_button]:px-2.5 [&_button]:py-1.5 [&_button]:text-xs">
														<button onClick={() => send('duplicate', server.id)}>
															<Copy size={15} />
															Duplicate
														</button>
														<button disabled={!!query} onClick={() => send('up', server.id)}>
															<ArrowUp size={15} />
															Move up
														</button>
														<button disabled={!!query} onClick={() => send('down', server.id)}>
															<ArrowDown size={15} />
															Move down
														</button>
														<button onClick={() => send('export', server.id)}>
															<Download size={15} />
															Export
														</button>
														<button
															className="mt-1 rounded-none! border-t-(--vscode-panel-border)! text-(--vscode-errorForeground)"
															onClick={() => send('delete', server.id)}
														>
															<Trash2 size={15} />
															Delete
														</button>
													</div>
												)}
											</div>
										</div>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</main>
	);
}

createRoot(document.getElementById('root')!).render(<App />);
