import type { HttpResult } from '@/result/protocol';
import { cn } from 'cn';
import { Loading } from '../components/ui/loading';

export function HttpResultView({ result }: { result: HttpResult }) {
	return (
		<div className="grid h-screen min-w-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
			<header className=" flex min-h-10 flex-wrap items-center gap-3 border-b border-(--vscode-panel-border) px-4 py-2">
				<span className="shrink-0 font-semibold text-(--vscode-symbolIcon-functionForeground)">
					{result.method}
				</span>
				<span
					className="min-w-0 flex-1 truncate font-(family-name:--vscode-editor-font-family) text-(--vscode-textLink-foreground)"
					title={result.url}
				>
					{result.url}
				</span>
				{result.status !== undefined && (
					<span className="ml-auto flex flex-wrap items-center gap-3">
						<span
							className={cn(
								'font-semibold',
								result.status < 300
									? 'text-(--vscode-testing-iconPassed)'
									: result.status < 400
										? 'text-(--vscode-editorWarning-foreground)'
										: 'text-(--vscode-testing-iconFailed)',
							)}
						>
							{result.status} {result.statusText}
						</span>
						{result.elapsed !== undefined && (
							<span className="text-(--vscode-descriptionForeground)">{result.elapsed} ms</span>
						)}
					</span>
				)}
			</header>
			{result.state === 'loading' && (
				<Loading variant="inline" label="Sending request..." className="self-start p-3.5 text-(--vscode-descriptionForeground)" />
			)}
			{(result.state === 'error' || result.state === 'cancelled') && (
				<div
					role="status"
					className={cn(
						'min-h-0 overflow-auto p-3.5 wrap-anywhere',
						result.state === 'error'
							? 'text-(--vscode-errorForeground)'
							: 'text-(--vscode-descriptionForeground)',
					)}
				>
					{result.message}
				</div>
			)}
			{result.state === 'success' && (
				<main className="min-h-0 overflow-auto px-3.5 pt-3 pb-4.5">
					<details className="mb-3">
						<summary className="cursor-pointer text-xs font-semibold text-(--vscode-descriptionForeground) select-none">
							Response headers ({result.headers?.length ?? 0})
						</summary>
						<dl className="mt-2.5 grid grid-cols-1 gap-x-4.5 gap-y-1 font-(family-name:--vscode-editor-font-family) text-sm sm:grid-cols-[minmax(120px,max-content)_minmax(0,1fr)]">
							{result.headers?.map(([name, value], index) => (
								<Header key={index} name={name} value={value} />
							))}
						</dl>
					</details>
					<div className="mb-2 text-xs font-semibold text-(--vscode-descriptionForeground)">
						Response body
					</div>
					<pre className="m-0 rounded-sm border border-(--vscode-panel-border) bg-(--vscode-textCodeBlock-background) px-3 py-2.5 font-(family-name:--vscode-editor-font-family) text-(length:--vscode-editor-font-size) leading-normal whitespace-pre-wrap wrap-anywhere">
						{result.body || '(empty response)'}
					</pre>
				</main>
			)}
		</div>
	);
}

function Header({ name, value }: { name: string; value: string }) {
	return (
		<>
			<dt className="wrap-anywhere">{name}</dt>
			<dd className="m-0 min-w-0 wrap-anywhere">{value}</dd>
		</>
	);
}
