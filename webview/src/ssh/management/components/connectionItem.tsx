import { IconButton } from '../../../components/ui/button';
import { Play, Terminal } from '../../../components/ui/icons';
import { ListItem } from '../../../components/ui/list';

export type Connection = { id: string; name: string; group: string; address: string; kind: string; commandCount: number };

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
			icon={<Terminal />}
			data-vscode-context={JSON.stringify({
				webviewSection: 'connectionItem',
				dashboardTab: 'ssh',
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
