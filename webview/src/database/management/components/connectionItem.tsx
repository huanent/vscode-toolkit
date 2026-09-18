import { IconButton } from '../../../components/ui/button';
import { Database, Play } from '../../../components/ui/icons';
import { ListItem } from '../../../components/ui/list';

export type Connection = { id: string; name: string; group: string; address: string; kind: string };

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
			icon={<Database />}
			data-vscode-context={JSON.stringify({
				webviewSection: 'connectionItem',
				dashboardTab: 'database',
				connectionId: server.id,
				dashboardFiltered: filtered,
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
