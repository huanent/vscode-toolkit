import { IconButton } from '../../components/ui/button';
import { Container, Database, Play, Terminal } from '../../components/ui/icons';
import { ListItem } from '../../components/ui/list';

export type Connection = { id: string; name: string; group: string; address: string; kind: string; commandCount: number; connectionType: 'ssh' | 'database' | 'container' };

export function ConnectionItem({
	server,
	filtered,
	onAction,
}: {
	server: Connection;
	filtered: boolean;
	onAction(type: string, id: string): void;
}) {
	return (
		<ListItem
			icon={server.connectionType === 'database' ? <Database /> : server.connectionType === 'container' ? <Container /> : <Terminal />}
			data-vscode-context={JSON.stringify({
				webviewSection: 'connectionItem',
				dashboardTab: server.connectionType,
				connectionId: server.id,
				dashboardFiltered: filtered,
				dashboardHasScripts: server.commandCount > 0,
				preventDefaultContextMenuItems: true,
			})}
			description={server.address}
			actions={
				<>
					<IconButton
						size="sm"
						icon={<Play />}
						label={`Open ${server.name}`}
						onClick={() => {
							onAction('connect', server.id);
						}}
					/>
				</>
			}
		>
			{server.name}
		</ListItem>
	);
}
