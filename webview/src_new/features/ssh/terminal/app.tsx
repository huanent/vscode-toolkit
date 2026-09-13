import { cn } from 'cn';
import { useRef } from 'react';
import { CircleAlert, LoaderCircle } from '../../../components/icons';
import { RemoteMetrics } from './components/remoteMetrics';
import { SftpPanel } from './components/sftpPanel';
import { TerminalView, type TerminalViewHandle } from './components/terminalView';
import { useSshTerminal } from './hooks/useSshTerminal';

export function App() {
	const terminalRef = useRef<TerminalViewHandle>(null);
	const ssh = useSshTerminal(
		data => terminalRef.current?.writeBase64(data),
		data => terminalRef.current?.paste(data),
		() => terminalRef.current?.fit(),
		() => terminalRef.current?.focus(),
	);
	return (
		<div className="grid h-screen grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
			<RemoteMetrics metrics={ssh.metrics} />
			<main
				className={cn(
					'grid min-h-0',
					ssh.sftpVisible
						? 'grid-cols-[minmax(320px,3fr)_minmax(280px,2fr)] max-[760px]:grid-cols-1 max-[760px]:grid-rows-[minmax(0,1fr)_minmax(0,1fr)]'
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
									{ssh.status === 'connecting' ? (
										<LoaderCircle className="codicon-modifier-spin text-(--vscode-progressBar-background)" />
									) : (
										<CircleAlert />
									)}
								</span>
								<strong className="text-sm">
									{ssh.status === 'connecting'
										? 'Connecting'
										: ssh.status === 'error'
											? 'Connection failed'
											: 'Connection closed'}
								</strong>
								<span className="min-w-0 font-(family-name:--vscode-editor-font-family) text-xs wrap-anywhere">
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
