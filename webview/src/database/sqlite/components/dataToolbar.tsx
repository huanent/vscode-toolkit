import { IconButton } from '../../../components/ui/button';
import { ChevronLeft, ChevronRight, Plus } from '../../../components/ui/icons';

interface DataToolbarProps {
	totalRows: number;
	currentPage: number;
	pageSize: number;
	canCreate: boolean;
	onCreate: () => void;
	onPrevious: () => void;
	onNext: () => void;
}

export function DataToolbar({
	totalRows,
	currentPage,
	pageSize,
	canCreate,
	onCreate,
	onPrevious,
	onNext,
}: DataToolbarProps) {
	const pageCount = Math.ceil(totalRows / pageSize);
	return (
		<header className="flex min-h-9 shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-(--vscode-panel-border) px-3 py-1 text-xs tabular-nums text-(--vscode-descriptionForeground)">
			<IconButton
				icon={<Plus />}
				label="New row"
				size="sm"
				disabled={!canCreate}
				onClick={onCreate}
			/>
			<span className="flex-1">Rows: {totalRows}</span>
			<span>
				{totalRows === 0 ? 0 : currentPage}/{pageCount}
			</span>
			<div className="flex items-center gap-0.5">
				<IconButton
					icon={<ChevronLeft />}
					label="Previous page"
					size="sm"
					disabled={currentPage <= 1 || totalRows === 0}
					onClick={onPrevious}
				/>
				<IconButton
					icon={<ChevronRight />}
					label="Next page"
					size="sm"
					disabled={currentPage >= pageCount}
					onClick={onNext}
				/>
			</div>
		</header>
	);
}
