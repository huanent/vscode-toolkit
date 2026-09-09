import { cn } from 'cn';
import type { RemoteMetricsDisplay } from './types';

const metricColorClassNames = [
	'before:bg-(--vscode-charts-blue)',
	'before:bg-(--vscode-charts-green)',
	'before:bg-(--vscode-charts-yellow)',
	'before:bg-(--vscode-charts-purple)',
];

interface RemoteMetricsProps {
	metrics: RemoteMetricsDisplay;
}

export function RemoteMetrics({ metrics }: RemoteMetricsProps) {
	return (
		<header
			className="grid grid-cols-4 border-b border-(--vscode-panel-border,var(--vscode-widget-border)) max-[760px]:grid-cols-2"
			aria-label="Remote server metrics"
		>
			{Object.entries(metrics).map(([label, value], index) => (
				<div
					key={label}
					className={cn(
						'relative flex min-h-9 min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-1 py-2 pr-3 pl-4 before:absolute before:left-1.5 before:h-3 before:w-0.75',
						metricColorClassNames[index],
					)}
				>
					<span className="text-xs font-medium text-(--vscode-descriptionForeground)">
						{label}
					</span>
					<span className="min-w-0 font-(family-name:--vscode-editor-font-family) text-sm tabular-nums wrap-anywhere">
						{value}
					</span>
				</div>
			))}
		</header>
	);
}
