interface PaginationFooterProps {
	totalRows: number;
	currentPage: number;
	pageSize: number;
	onPrevious: () => void;
	onNext: () => void;
}

export function PaginationFooter({
	totalRows,
	currentPage,
	pageSize,
	onPrevious,
	onNext,
}: PaginationFooterProps) {
	const pageCount = Math.ceil(totalRows / pageSize);
	return (
		<footer className="flex h-8 shrink-0 items-center gap-3 border-t border-(--vscode-panel-border) px-3 text-[11px] text-(--vscode-descriptionForeground)">
			<span className="flex-1">Rows: {totalRows}</span>
			<span>
				{pageCount}/{totalRows === 0 ? 0 : currentPage}
			</span>
			<div className="flex items-center gap-0.5">
				<button
					type="button"
					title="Previous page"
					aria-label="Previous page"
					disabled={currentPage <= 1 || totalRows === 0}
					className="grid size-6 place-items-center border-0 bg-transparent text-(--vscode-icon-foreground) enabled:hover:bg-(--vscode-toolbar-hoverBackground) disabled:opacity-35"
					onClick={onPrevious}
				>
					<i className="codicon codicon-chevron-left" aria-hidden="true" />
				</button>
				<button
					type="button"
					title="Next page"
					aria-label="Next page"
					disabled={currentPage >= pageCount}
					className="grid size-6 place-items-center border-0 bg-transparent text-(--vscode-icon-foreground) enabled:hover:bg-(--vscode-toolbar-hoverBackground) disabled:opacity-35"
					onClick={onNext}
				>
					<i className="codicon codicon-chevron-right" aria-hidden="true" />
				</button>
			</div>
		</footer>
	);
}
