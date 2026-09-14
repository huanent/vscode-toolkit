import { cn } from 'cn';
import { IconButton } from '../../../../components/ui/button';
import {
	ChevronLeft,
	ChevronRight,
	LoaderCircle,
	Plus,
	RefreshCw
} from '../../../../components/ui/icons';
import { Select } from '../../../../components/ui/input';
import { Table } from './components/dataTable';
import { RowDialog } from './components/rowDialog';
import { Status } from './components/status';
import { useMysqlTablePreview } from './hooks/useMysqlTablePreview';
import { useTableFilters } from './hooks/useTableFilters';

export const pageSizes = [50, 100, 300, 500, 1000];

export function App() {
	const preview = useMysqlTablePreview();
	const { filters, setFilters } = useTableFilters(preview);

	if (!preview.identity)
		return (
			<div className="grid h-screen place-items-center">
				<LoaderCircle className="animate-spin" />
			</div>
		);
	const data = preview.data;
	return (
		<div className="grid h-screen min-w-0 grid-rows-[minmax(0,1fr)_auto] overflow-hidden pt-11">
			<header className="fixed inset-x-0 top-0 z-20 flex h-11 min-w-0 items-center border-b border-(--vscode-panel-border,var(--vscode-widget-border)) bg-(--vscode-editor-background) px-1">
				<span className="flex min-w-0 w-full items-center gap-1 whitespace-nowrap text-xs">
					<span>{data ? new Intl.NumberFormat().format(data.totalRows) : ''} Rows</span>
					<span className="w-18 shrink-0">
						<Select
							aria-label="Rows per page"
							disabled={!data || preview.loading}
							size="sm" className="w-18"
							value={data?.pageSize ?? 100}
							onChange={event =>
								data && preview.loadPage(1, Number(event.target.value), data.sort, data.filters)
							}
						>
							{pageSizes.map(size => (
								<option key={size}>{size}</option>
							))}
						</Select>
					</span>
					<span
						className="min-w-0 truncate px-1 tabular-nums"
						title={`${data?.page ?? 1} / ${data?.totalPages ?? 1}`}
					>
						{data?.page ?? 1} / {data?.totalPages ?? 1}
					</span>
					<IconButton

						disabled={!data || preview.loading || data.page <= 1}
						label="Previous page"
						onClick={() => data && preview.loadPage(data.page - 1)}
						icon={<ChevronLeft size="md" />} />
					<IconButton

						disabled={!data || preview.loading || data.page >= data.totalPages}
						label="Next page"
						onClick={() => data && preview.loadPage(data.page + 1)}
						icon={<ChevronRight size="md" />} />
					<IconButton
						className="ml-auto"
						label="Insert row"
						disabled={!data || preview.loading}
						onClick={preview.openInsert}
						icon={<Plus size="md" />} />
					<IconButton

						label="Refresh"
						disabled={preview.loading}
						onClick={preview.refresh}
						icon={<RefreshCw size="md" className={cn(preview.loading ? 'animate-spin' : '')} />} />
				</span>
			</header>
			<main aria-busy={preview.loading} className="min-h-0 overflow-auto">
				{preview.loading && !data ? (
					<Status loading>Loading table...</Status>
				) : preview.error && !data ? (
					<Status error>{preview.error}</Status>
				) : data ? (
					<Table preview={preview} filters={filters} setFilters={setFilters} />
				) : null}
			</main>
			{preview.dialog && data && <RowDialog preview={preview} />}
		</div>
	);
}
