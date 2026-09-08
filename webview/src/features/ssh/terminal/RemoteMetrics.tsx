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
			className="grid grid-cols-4 border-b border-(--vscode-panel-border,var(--vscode-widget-border))"
			aria-label="Remote server metrics"
		>
			{Object.entries(metrics).map(([label, value], index) => (
				<div
					key={label}
					className={cn(
						'relative flex rounded-xs min-w-0 items-center justify-between gap-2 px-2.5 pl-3.5 before:absolute before:left-1.5 before:h-3 before:w-0.75',
						metricColorClassNames[index],
					)}
				>
					<span className="text-[10px] font-semibold uppercase text-(--vscode-descriptionForeground)">
						{label}
					</span>
					<span className="min-w-0 overflow-hidden font-(family-name:--vscode-editor-font-family) text-xs text-ellipsis whitespace-nowrap">
						{value}
					</span>
				</div>
			))}
		</header>
	);
}
