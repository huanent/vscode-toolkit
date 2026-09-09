import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowLeft, ArrowRight, Copy, Download, Pencil, Plus, RefreshCw, Search, Trash2, Upload, X } from 'lucide-react';
import { IconButton, PrimaryButton } from '../../../components/ui/button';
import { vscode } from '../../../vscodeApi';
import { ServerDialog } from './ServerDialog';

interface Connection {
	id: string;
	name: string;
	group: string;
	address: string;
	kind: string;
}

const send = (type: string, id?: string) => vscode.postMessage({ type, id });

function ConnectionCard({ server, filtered }: { server: Connection; filtered: boolean }) {
	const [position, setPosition] = useState<{ left: number; top: number }>();
	const open = position !== undefined;
	const container = useRef<HTMLLIElement>(null);
	const menu = useRef<HTMLDivElement>(null);
	const focusTrigger = () => container.current?.querySelector<HTMLButtonElement>('button')?.focus();
	useLayoutEffect(() => {
		if (!position || !menu.current) return;
		const bounds = menu.current.getBoundingClientRect();
		const left = Math.max(4, Math.min(position.left, window.innerWidth - bounds.width - 4));
		const top = Math.max(4, Math.min(position.top, window.innerHeight - bounds.height - 4));
		if (left !== position.left || top !== position.top) setPosition({ left, top });
		menu.current.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
	}, [position]);
	useEffect(() => {
		if (!open) return;
		const dismiss = (event: PointerEvent) => {
			if (!container.current?.contains(event.target as Node)) setPosition(undefined);
		};
		const close = () => setPosition(undefined);
		const escape = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				setPosition(undefined);
				focusTrigger();
			}
		};
		document.addEventListener('pointerdown', dismiss);
		document.addEventListener('keydown', escape);
		window.addEventListener('resize', close);
		window.addEventListener('scroll', close);
		return () => {
			document.removeEventListener('pointerdown', dismiss);
			document.removeEventListener('keydown', escape);
			window.removeEventListener('resize', close);
			window.removeEventListener('scroll', close);
		};
	}, [open]);
	const actions = [
		{ type: 'edit', label: 'Edit', icon: Pencil },
		{ type: 'duplicate', label: 'Duplicate', icon: Copy },
		{ type: 'up', label: 'Move Earlier', icon: ArrowLeft, disabled: filtered },
		{ type: 'down', label: 'Move Later', icon: ArrowRight, disabled: filtered },
		{ type: 'export', label: 'Export', icon: Download },
		{ type: 'delete', label: 'Delete', icon: Trash2 },
	];
	return (
		<li ref={container} className="relative flex min-w-0 items-center rounded-sm border border-(--vscode-panel-border) hover:bg-(--vscode-list-hoverBackground) focus-within:border-(--vscode-focusBorder)" onBlur={event => {
			if (!event.currentTarget.contains(event.relatedTarget)) setPosition(undefined);
		}} onContextMenu={event => {
			event.preventDefault();
			setPosition({ left: event.clientX, top: event.clientY });
		}} onKeyDown={event => {
			if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
				event.preventDefault();
				const bounds = event.currentTarget.getBoundingClientRect();
				setPosition({ left: bounds.left, top: bounds.bottom });
			}
		}}>
			<button type="button" className="flex min-w-0 flex-1 flex-col gap-0.5 rounded-sm bg-transparent p-2 text-left" title={`Connect ${server.name}\n${server.address}`} aria-label={`Connect ${server.name}`} onClick={() => send('connect', server.id)}>
				<span className="w-full truncate text-sm font-medium">{server.name}</span>
				<span className="w-full truncate text-xs text-(--vscode-descriptionForeground)">{server.address}</span>
			</button>
			{open && (
				<div ref={menu} id={`actions-${server.id}`} role="group" aria-label={`Actions for ${server.name}`} style={position} className="fixed z-50 max-h-[calc(100vh-8px)] w-44 overflow-y-auto rounded-sm border border-(--vscode-menu-border,var(--vscode-panel-border)) bg-(--vscode-menu-background,var(--vscode-editor-background)) p-1 text-(--vscode-menu-foreground,var(--vscode-foreground)) shadow-sm">
					{actions.map(({ type, label, icon: Icon, disabled }) => (
						<button key={type} type="button" disabled={disabled} className="flex w-full items-center gap-2 rounded-xs px-2 py-1.5 text-left text-xs hover:bg-(--vscode-menu-selectionBackground) hover:text-(--vscode-menu-selectionForeground) disabled:opacity-40" onClick={() => {
							setPosition(undefined);
							focusTrigger();
							send(type, server.id);
						}}><Icon size={14} /><span>{label}</span></button>
					))}
				</div>
			)}
		</li>
	);
}

function App() {
	const [formSession, setFormSession] = useState<number>();
	const [closeForm] = useState(() => () => {
		setFormSession(undefined);
		send('closeForm');
	});
	const [state, setState] = useState<{ name: string; servers: Connection[] }>();
	const [query, setQuery] = useState('');
	useEffect(() => {
		const receive = (event: MessageEvent) => {
			if (event.data.type === 'state') setState(event.data);
			if (event.data.type === 'openForm') setFormSession(event.data.sessionId);
		};
		window.addEventListener('message', receive);
		send('ready');
		return () => window.removeEventListener('message', receive);
	}, []);
	const servers = state?.servers.filter(server =>
		`${server.name} ${server.group} ${server.address} ${server.kind}`.toLowerCase().includes(query.toLowerCase()),
	) ?? [];
	const groups = new Map<string, Connection[]>();
	for (const server of servers) {
		const group = server.group.trim();
		const connections = groups.get(group);
		if (connections) connections.push(server);
		else groups.set(group, [server]);
	}
	return (
		<main className="mx-auto max-w-7xl p-4 text-(--vscode-foreground) max-[600px]:p-3">
			<header className="mb-4 flex flex-wrap items-center gap-2">
				<h1 className="mr-auto text-sm font-semibold">{state?.name ?? 'Connections'}</h1>
				<label className="flex h-8 w-64 items-center gap-2 rounded-xs border border-(--vscode-input-border,transparent) bg-(--vscode-input-background) px-2 text-(--vscode-input-foreground) focus-within:outline focus-within:outline-(--vscode-focusBorder) max-[600px]:order-last max-[600px]:w-full">
					<Search size={14} className="shrink-0" />
					<input className="min-w-0 flex-1 bg-transparent text-xs outline-none" aria-label="Search connections" placeholder="Search connections" value={query} onChange={event => setQuery(event.target.value)} />
					{query && <IconButton className="size-6" title="Clear search" aria-label="Clear search" onClick={() => setQuery('')}><X size={14} /></IconButton>}
				</label>
				<div className="flex items-center gap-0.5">
					<IconButton title="Import connections" aria-label="Import connections" onClick={() => send('import')}><Upload size={15} /></IconButton>
					<IconButton title="Export connections" aria-label="Export connections" disabled={!state?.servers.length} onClick={() => send('exportAll')}><Download size={15} /></IconButton>
					<IconButton title="Refresh" aria-label="Refresh" onClick={() => send('refresh')}><RefreshCw size={15} /></IconButton>
					<PrimaryButton onClick={() => send('add')}><Plus size={15} />New connection</PrimaryButton>
				</div>
			</header>
			{!state ? <p role="status" className="text-xs text-(--vscode-descriptionForeground)">Loading...</p> : servers.length === 0 ? (
				<p role="status" className="py-6 text-center text-xs text-(--vscode-descriptionForeground)">{query ? 'No matching connections.' : 'No connections yet.'}</p>
			) : (
				<div className="space-y-4">
					{Array.from(groups, ([group, connections]) => (
						<section key={group} aria-label={group || 'Ungrouped'}>
							<h2 className="mb-1.5 text-xs font-semibold wrap-anywhere text-(--vscode-descriptionForeground)">{group || 'Ungrouped'}</h2>
							<ul aria-label={group || 'Ungrouped'} className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(100%,180px),1fr))] gap-2 p-0">
								{connections.map(server => <ConnectionCard key={server.id} server={server} filtered={!!query} />)}
							</ul>
						</section>
					))}
				</div>
			)}
			{formSession !== undefined && <ServerDialog key={formSession} sessionId={formSession} onClose={closeForm} />}
		</main>
	);
}

createRoot(document.getElementById('root')!).render(<App />);