import { HttpResultView } from './httpResultView';
import { TableResultView } from './tableResultView';
import { WorkflowResultView } from './workflowResultView';
import { useResult } from './useResult';
import { ResultHistory } from './resultHistory';

export function App() {
	const { result, history } = useResult();
	return (
		<div className="grid h-screen min-w-0 grid-cols-[minmax(0,1fr)_minmax(140px,28%)] overflow-hidden sm:grid-cols-[minmax(0,1fr)_240px]">
			<div key={history.selectedId} className="min-h-0 min-w-0 overflow-hidden">
				{!result ? <p className="p-3 text-xs text-(--vscode-descriptionForeground)">No results yet.</p>
					: result.type === 'workflow' ? <WorkflowResultView result={result.data} />
						: result.type === 'http' ? <HttpResultView result={result.data} />
							: <TableResultView result={result.data} />}
			</div>
			<ResultHistory history={history} />
		</div>
	);
}
