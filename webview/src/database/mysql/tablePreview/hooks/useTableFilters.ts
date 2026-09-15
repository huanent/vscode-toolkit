import { useEffect, useRef, useState } from 'react';
import type { PreviewState } from './useMysqlTablePreview';

export function useTableFilters(preview: PreviewState) {
	const [filters, setFilters]=useState<Record<string, string>>({});
	const filtersInitialized=useRef(false);
	useEffect(() => {
		if(!preview.data||filtersInitialized.current) return;
		filtersInitialized.current=true;
		setFilters(
			Object.fromEntries(preview.data.filters.map(filter => [filter.column, filter.value])),
		);
	}, [preview.data?.filters]);
	useEffect(() => {
		if(!preview.data) return;
		const timer=window.setTimeout(() => {
			const next=Object.entries(filters)
				.filter(([, value]) => value!=='')
				.map(([column, value]) => ({ column, value }));
			if(JSON.stringify(next)!==JSON.stringify(preview.data!.filters))
				preview.loadPage(1, preview.data!.pageSize, preview.data!.sort, next);
		}, 350);
		return () => window.clearTimeout(timer);
	}, [filters]);

	return { filters, setFilters };
}
