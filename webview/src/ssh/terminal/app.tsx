import { cn } from 'cn';
import { useRef } from 'react';
import { Empty } from '../../components/ui/empty';
import { CircleAlert } from '../../components/ui/icons';
import { Loading } from '../../components/ui/loading';
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
						<Empty
							role="status"
							className={cn(
								'pointer-events-none absolute inset-0 z-10',
								ssh.status === 'error'
									? 'text-(--vscode-errorForeground)'
									: 'text-(--vscode-descriptionForeground)',
							)}
							titleClassName={
								ssh.status === 'error' ? 'text-(--vscode-errorForeground)' : undefined
							}
							icon={
								ssh.status === 'connecting' ? (
									<Loading variant="icon" label="Connecting" className="text-(--vscode-progressBar-background)" />
								) : (
									<CircleAlert />
								)
							}
							title={
								ssh.status === 'connecting'
									? 'Connecting'
									: ssh.status === 'error'
										? 'Connection failed'
										: 'Connection closed'
							}
							description={ssh.statusMessage || ssh.server?.address}
							descriptionClassName="font-(family-name:--vscode-editor-font-family)"
						/>
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
