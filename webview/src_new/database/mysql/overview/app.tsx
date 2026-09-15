import { IconButton } from '../../../components/ui/button';
import {
	Download,
	Gist,
	LoaderCircle,
	Plus,
	RefreshCw,
	Trash2,
	Upload
} from '../../../components/ui/icons';
import { Select } from '../../../components/ui/input';
import { TableDefinitionDialog } from './components/tableDefinitionDialog';
import { TableList } from './components/tableList';
import { useMysqlOverview } from './hooks/useMysqlOverview';

export function App() {
	const mysql = useMysqlOverview();
	if (!mysql.server)
		return (
			<div className="grid h-screen place-items-center">
				<LoaderCircle className="animate-spin" />
			</div>
		);
	return (
		<div className="grid h-screen min-w-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden text-[0.9em]">
			<header className="flex min-w-0 items-center gap-2 border-b border-(--vscode-panel-border,var(--vscode-widget-border)) px-1 pt-0 pb-1">
				<Select
					aria-label="Database"
					className="min-w-0 max-w-64 flex-1"
					value={mysql.database}
					onChange={event => mysql.setDatabase(event.target.value)}
				>
					{!mysql.database && <option value="">No database</option>}
					{mysql.databases.map(database => (
						<option key={database}>{database}</option>
					))}
				</Select>
				<div className="flex shrink-0 gap-1">
					<IconButton label="Create database" onClick={mysql.createDatabase} icon={<Plus size="md" />} />
					<IconButton

						label="Delete database"
						disabled={!mysql.database}
						onClick={mysql.deleteDatabase}
						icon={<Trash2 size="md" />} />
				</div>
				<div className="ml-auto flex shrink-0 gap-1">
					<IconButton

						label="Open SQL editor"
						disabled={!mysql.database}
						onClick={mysql.openSql}
						icon={<Gist size="md" />} />
					<IconButton label="Import database" onClick={mysql.importDatabase} icon={<Download size="md" />} />
					<IconButton

						label="Export database"
						disabled={!mysql.database}
						onClick={mysql.exportDatabase}
						icon={<Upload size="md" />} />
					<IconButton label="Refresh" onClick={mysql.refresh} icon={<RefreshCw size="md" />} />
				</div>
			</header>
			<main className="min-h-0 min-w-0 overflow-auto">
				<TableList tables={mysql.tables} mysql={mysql} />
			</main>
			{mysql.dialog && <TableDefinitionDialog mysql={mysql} />}
		</div>
	);
}
