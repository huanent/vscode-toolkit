import { HttpResultView } from './httpResultView';
import { TableResultView } from './tableResultView';
import { useResult } from './useResult';

export function App() {
	const result = useResult();
	if (!result) return null;
	return result.type === 'http' ? (
		<HttpResultView result={result.data} />
	) : (
		<TableResultView result={result.data} />
	);
}
