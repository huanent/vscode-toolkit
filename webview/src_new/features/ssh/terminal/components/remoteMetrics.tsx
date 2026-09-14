import { cn } from 'cn';
import type { RemoteMetricsDisplay } from '../types';

const metricColorClassNames = [
	'border-l-(--vscode-charts-blue)',
	'border-l-(--vscode-charts-green)',
	'border-l-(--vscode-charts-yellow)',
	'border-l-(--vscode-charts-purple)',
];

interface RemoteMetricsProps {
	metrics: RemoteMetricsDisplay;
}

export function RemoteMetrics({ metrics }: RemoteMetricsProps) {
	return (
		<header
			className="grid grid-cols-4 gap-x-4 gap-y-2 border-b border-(--vscode-panel-border,var(--vscode-widget-border)) px-3 py-2 text-sm max-[760px]:grid-cols-2"
			aria-label="Remote server metrics"
		>
			{Object.entries(metrics).map(([label, value], index) => (
				<div
					key={label}
					className={cn(
						'flex min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-1 border-l-3 pl-2',
						metricColorClassNames[index],
					)}
				>
					<span className="text-(--vscode-descriptionForeground)">{label}</span>
					<span className="min-w-0 tabular-nums wrap-anywhere">{value}</span>
				</div>
			))}
		</header>
	);
}
