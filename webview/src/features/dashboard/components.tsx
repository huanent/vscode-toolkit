import type { ReactNode } from 'react';
import { IconButton, PrimaryButton } from '../../components/button';
import { LoaderCircle, Plus, Search, X } from '../../components/icons';

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
			<Search size={14} className="shrink-0" aria-hidden="true" />
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
				type="button"
				className={`size-6 rounded-xs ${value ? '' : 'invisible'}`}
				title="Clear search"
				aria-label="Clear search"
				onClick={event => {
					onChange('');
					event.currentTarget.parentElement?.querySelector('input')?.focus();
				}}
			>
				<X size={14} />
			</IconButton>
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
				<LoaderCircle size={20} className="motion-safe:animate-spin" aria-hidden="true" />
			)}
			<p>{loading ? 'Loading...' : filtered ? `No matching ${noun}.` : `No ${noun} yet.`}</p>
			{!loading &&
				(filtered ? (
					<IconButton title="Clear search" aria-label="Clear search" onClick={onClear}>
						<X size={16} />
					</IconButton>
				) : (
					onCreate && (
						<PrimaryButton className="rounded-xs text-xs" disabled={disabled} onClick={onCreate}>
							<Plus size={14} />
							{noun === 'workflows' ? 'New workflow' : 'New connection'}
						</PrimaryButton>
					)
				))}
		</div>
	);
}
