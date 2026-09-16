import { HttpResultView } from './httpResultView';
import { TableResultView } from './tableResultView';
import { WorkflowResultView } from './workflowResultView';
import { useResult } from './useResult';

export function App() {
	const result = useResult();
	if (!result) return null;
	if (result.type === 'workflow') return <WorkflowResultView result={result.data} />;
	return result.type === 'http' ? (
		<HttpResultView result={result.data} />
	) : (
		<TableResultView result={result.data} />
	);
}
