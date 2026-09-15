import type { ReactNode } from 'react';
import { Button, IconButton } from '../components/ui/button';
import { LoaderCircle, Plus, Search, X } from '../components/ui/icons';

export function DashboardHeader({
	title,
	count,
	children,
}: {
	title: string;
	count?: number;
	children: ReactNode;
}) {
	return (
		<header className="mb-3 flex min-h-8 flex-wrap items-center gap-2">
			<h1 className="flex min-w-0 items-center gap-2 text-sm font-semibold">
				{title}
				{count !== undefined && (
					<span className="text-xs font-normal tabular-nums text-(--vscode-descriptionForeground)">
						{count}
					</span>
				)}
			</h1>
			<div className="ml-auto flex shrink-0 items-center gap-0.5">{children}</div>
		</header>
	);
}

export function DashboardSearch({
	label,
	value,
	onChange,
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
}) {
	return (
		<label className="mb-3 flex h-8 min-w-0 items-center gap-2 rounded-xs border border-(--vscode-input-border,transparent) bg-(--vscode-input-background) px-2 text-(--vscode-input-foreground) focus-within:outline focus-within:outline-(--vscode-focusBorder)">
			<Search size="sm" className="shrink-0" aria-hidden="true" />
			<input
				type="text"
				className="min-w-0 flex-1 bg-transparent text-xs outline-none"
				aria-label={label}
				placeholder={label}
				value={value}
				onChange={event => onChange(event.target.value)}
				onKeyDown={event => {
					if (event.key === 'Escape' && value) {
						event.preventDefault();
						onChange('');
					}
				}}
			/>
			<IconButton
				size="sm"
				className={value ? '' : 'invisible'}
				label="Clear search"
				icon={<X size="sm" />}
				onClick={event => {
					onChange('');
					event.currentTarget.parentElement?.querySelector('input')?.focus();
				}}
			/>
		</label>
	);
}

export function DashboardEmpty({
	loading = false,
	filtered = false,
	noun,
	onCreate,
	onClear,
	disabled = false,
}: {
	loading?: boolean;
	filtered?: boolean;
	noun: string;
	onCreate?: () => void;
	onClear?: () => void;
	disabled?: boolean;
}) {
	return (
		<div
			role="status"
			className="flex min-h-36 flex-col items-center justify-center gap-3 px-3 py-6 text-center text-xs text-(--vscode-descriptionForeground)"
		>
			{loading && (
				<LoaderCircle size="lg" className="motion-safe:animate-spin" aria-hidden="true" />
			)}
			<p>{loading ? 'Loading...' : filtered ? `No matching ${noun}.` : `No ${noun} yet.`}</p>
			{!loading &&
				(filtered ? (
						<IconButton label="Clear search" icon={<X size="md" />} onClick={onClear} />
				) : (
					onCreate && (
							<Button size="sm" left={<Plus size="sm" />} disabled={disabled} onClick={onCreate}>
							{noun === 'workflows' ? 'New workflow' : 'New connection'}
							</Button>
					)
				))}
		</div>
	);
}
