import { cn } from 'cn';
import { LoaderCircle, X } from 'lucide-react';
import { IconButton } from '../../../components';
import type { LaunchAgentDetails } from '../types';
import { stateText } from '../utils';
import { Eyebrow } from './AgentEditor';
import { StatusDot } from './AgentList';

export function LaunchdDetails({
	loading,
	details,
	onClose,
}: {
	loading: boolean;
	details?: LaunchAgentDetails;
	onClose(): void;
}) {
	return (
		<div
			className="fixed inset-0 z-20 flex justify-end bg-black/30 backdrop-blur-[1px]"
			role="presentation"
			onMouseDown={event => {
				if (event.target === event.currentTarget) onClose();
			}}
		>
			<section
				className="h-full w-[min(620px,calc(100%-32px))] overflow-auto border-l border-(--vscode-panel-border) bg-(--vscode-editor-background) shadow-[-16px_0_32px_var(--vscode-widget-shadow)] max-[760px]:w-full"
				role="dialog"
				aria-modal="true"
				aria-label="LaunchAgent runtime details"
			>
				<div className="sticky top-0 z-10 flex min-h-17 items-center justify-between gap-4 border-b border-b-(--vscode-panel-border) bg-(--vscode-editorWidget-background) px-5 py-3">
					<div className="min-w-0">
						<Eyebrow>Runtime details</Eyebrow>
						<h2 className="m-0 truncate text-[16px] font-semibold">
							{details?.label || 'Loading'}
						</h2>
					</div>
					<IconButton
						type="button"
						title="Close"
						aria-label="Close runtime details"
						onClick={onClose}
					>
						<X size={17} />
					</IconButton>
				</div>
				{loading ? (
					<div className="grid min-h-65 place-content-center justify-items-center gap-2.5 text-xs text-(--vscode-descriptionForeground)">
						<LoaderCircle className="animate-spin" size={22} />
						<span>Reading launchctl state</span>
					</div>
				) : (
					details && <DetailsContent details={details} />
				)}
			</section>
		</div>
	);
}

function DetailsContent({ details }: { details: LaunchAgentDetails }) {
	return (
		<div className="p-5">
			<div className="mb-4 flex items-center gap-2 rounded-xs border border-(--vscode-panel-border) bg-(--vscode-editorWidget-background) px-3 py-2.5 text-xs">
				<StatusDot state={details.state} />
				<strong>{stateText(details.state)}</strong>
			</div>
			<dl className="m-0 grid grid-cols-2 gap-px overflow-hidden rounded-xs border border-(--vscode-panel-border) bg-(--vscode-tree-tableColumnsBorder) max-[760px]:grid-cols-1">
				<Detail label="PID" value={details.pid} />
				<Detail label="Active count" value={details.activeCount} />
				<Detail label="Runs" value={details.runs} />
				<Detail label="Last exit code" value={details.lastExitCode} />
				<Detail label="Program" value={details.program} wide />
				<Detail label="Working directory" value={details.workingDirectory} wide />
				<Detail label="Standard output" value={details.standardOutPath} wide />
				<Detail label="Standard error" value={details.standardErrorPath} wide />
				<Detail label="Termination reason" value={details.reason} wide />
			</dl>
			<div className="mt-4 overflow-hidden rounded-xs border border-(--vscode-panel-border)">
				<h3 className="m-0 border-b border-(--vscode-panel-border) bg-(--vscode-editorWidget-background) px-3 py-2.5 text-[11px] font-semibold">
					launchctl print
				</h3>
				<pre className="m-0 max-h-110 overflow-auto bg-(--vscode-textCodeBlock-background) p-3 font-(--vscode-editor-font-family) text-[11px] leading-5 whitespace-pre text-(--vscode-editor-foreground)">
					{details.raw}
				</pre>
			</div>
		</div>
	);
}

function Detail({
	label,
	value,
	wide = false,
}: {
	label: string;
	value?: string | number;
	wide?: boolean;
}) {
	if (value === undefined || value === '') return null;
	return (
		<div
			className={cn(
				'min-w-0 bg-(--vscode-editorWidget-background) px-3 py-2.5',
				wide && 'col-span-2 max-[760px]:col-auto',
			)}
		>
			<dt className="mb-1 text-[10px] font-semibold uppercase text-(--vscode-descriptionForeground)">
				{label}
			</dt>
			<dd className="m-0 font-(--vscode-editor-font-family) text-xs leading-5 break-anywhere">
				{value}
			</dd>
		</div>
	);
}
