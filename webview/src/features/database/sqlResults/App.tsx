import { cn } from 'cn';
import { useEffect, useState } from 'react';
import { vscode } from '../../../vscodeApi';

type SqlResult =
	| {
			serverName: string;
			database: string;
			summary: string;
			kind: 'rows';
			columns: string[];
			rows: Array<Array<string | null>>;
	  }
	| { serverName: string; database: string; summary: string; kind: 'command'; message: string };

export function App() {
	const [result, setResult] = useState<SqlResult>();
	useEffect(() => {
		const listener = (event: MessageEvent<{ type: 'result'; result: SqlResult }>) => {
			if (event.data.type === 'result') setResult(event.data.result);
		};
		window.addEventListener('message', listener);
		vscode.postMessage({ type: 'ready' });
		return () => window.removeEventListener('message', listener);
	}, []);
	if (!result)
		return (
			<div className="grid min-h-screen place-items-center text-(--vscode-descriptionForeground)">
				Run a SQL statement to view results.
			</div>
		);
	return (
		<div className="grid h-screen min-w-0 grid-rows-[minmax(0,1fr)_auto] overflow-hidden">
			<main className="min-h-0 overflow-auto">
				{result.kind === 'command' ? (
					<div className="grid min-h-full place-items-center p-6 text-center text-(--vscode-descriptionForeground)">
						{result.message}
					</div>
				) : (
					<table
						aria-label="SQL results"
						className="w-max min-w-full border-separate border-spacing-0 font-(family-name:--vscode-editor-font-family) text-xs"
					>
						<thead>
							<tr>
								{result.columns.map((column, columnIndex) => (
									<th
										key={columnIndex}
										className="sticky top-0 z-10 h-9 min-w-28 max-w-120 overflow-hidden border-r border-b border-(--vscode-panel-border,var(--vscode-widget-border)) bg-(--vscode-editor-background) px-3 py-2 text-left font-semibold text-ellipsis whitespace-pre"
										title={column}
									>
										{column}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{result.rows.length === 0 && (
								<tr>
									<td
										colSpan={Math.max(1, result.columns.length)}
										className="px-4 py-12 text-center font-(family-name:--vscode-font-family) text-(--vscode-descriptionForeground)"
									>
										No rows returned.
									</td>
								</tr>
							)}
							{result.rows.map((row, rowIndex) => (
								<tr key={rowIndex} className="hover:bg-(--vscode-list-hoverBackground)">
									{row.map((value, columnIndex) => (
										<td
											key={columnIndex}
											className={cn(
												'max-w-120 overflow-hidden border-r border-b border-(--vscode-panel-border,var(--vscode-widget-border)) px-2.5 py-1.5 text-left text-ellipsis whitespace-pre',
												value === null ? 'italic text-(--vscode-descriptionForeground)' : '',
											)}
											title={value ?? 'NULL'}
										>
											{value ?? 'NULL'}
										</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				)}
			</main>
			<footer
				role="status"
				className="flex min-h-7 min-w-0 flex-wrap items-center gap-x-4 gap-y-1 border-t border-(--vscode-panel-border,var(--vscode-widget-border)) px-3 py-1 text-xs"
			>
				<span
					className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-(--vscode-descriptionForeground)"
					title={`Database ${result.serverName} / ${result.database}`}
				>
					Database {result.serverName} / {result.database}
				</span>
				<span className="ml-auto min-w-0 wrap-break-word">{result.summary}</span>
			</footer>
		</div>
	);
}
