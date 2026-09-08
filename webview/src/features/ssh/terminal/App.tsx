import { cn } from 'cn';
import { useRef } from 'react';
import { Codicon } from '../../../components/ui/codicon';
import { RemoteMetrics } from './RemoteMetrics';
import { SftpPanel } from './SftpPanel';
import { TerminalView, type TerminalViewHandle } from './TerminalView';
import { useSshTerminal } from './useSshTerminal';

export function App() {
	const terminalRef = useRef<TerminalViewHandle>(null);
	const ssh = useSshTerminal(
		data => terminalRef.current?.writeBase64(data),
		data => terminalRef.current?.paste(data),
		() => terminalRef.current?.fit(),
		() => terminalRef.current?.focus(),
	);
	return (
		<div className="grid h-screen grid-rows-[34px_minmax(0,1fr)] overflow-hidden">
			<RemoteMetrics metrics={ssh.metrics} />
			<main
				className={cn(
					'grid min-h-0',
					ssh.sftpVisible
						? 'grid-cols-[minmax(320px,3fr)_minmax(280px,2fr)] max-[760px]:grid-cols-[minmax(260px,1fr)_minmax(240px,1fr)]'
						: 'grid-cols-1',
				)}
			>
				<section className="relative min-h-0 min-w-0 py-1.5">
					<TerminalView
						ref={terminalRef}
						onData={ssh.input}
						onResize={ssh.resize}
						onReady={ssh.ready}
						onCopy={ssh.copy}
						onPaste={ssh.paste}
					/>
					{ssh.status !== 'connected' && (
						<div
							className={cn(
								'pointer-events-none absolute inset-0 z-10 flex items-center justify-center',
								ssh.status === 'error'
									? 'text-(--vscode-errorForeground)'
									: 'text-(--vscode-descriptionForeground)',
							)}
						>
							<div className="grid max-w-[min(520px,calc(100%-32px))] grid-cols-[18px_auto] items-center gap-x-3 gap-y-1">
								<span className="row-span-2">
									<Codicon
										name={ssh.status === 'connecting' ? 'loading' : 'warning'}
										className={cn(
											ssh.status === 'connecting'
												? 'codicon-modifier-spin text-(--vscode-progressBar-background)'
												: '',
										)}
										size={17}
									/>
								</span>
								<strong className="text-[13px]">
									{ssh.status === 'connecting'
										? 'Connecting'
										: ssh.status === 'error'
											? 'Connection failed'
											: 'Connection closed'}
								</strong>
								<span className="overflow-hidden font-(family-name:--vscode-editor-font-family) text-[11px] text-ellipsis whitespace-nowrap">
									{ssh.statusMessage || ssh.server?.address}
								</span>
							</div>
						</div>
					)}
				</section>
				{ssh.sftpVisible && (
					<SftpPanel
						sftp={{
							sftpPath: ssh.sftpPath,
							parentPath: ssh.parentPath,
							entries: ssh.entries,
							favorites: ssh.favorites,
							loading: ssh.sftpLoading,
							list: ssh.list,
							toggleFavorite: ssh.toggleFavorite,
							createDirectory: ssh.createDirectory,
							upload: ssh.upload,
							rename: ssh.rename,
							download: ssh.download,
							deleteEntry: ssh.deleteEntry,
							copyPath: ssh.copyPath,
							edit: ssh.edit,
						}}
					/>
				)}
			</main>
		</div>
	);
}
