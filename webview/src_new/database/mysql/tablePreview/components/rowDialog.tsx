import { Button } from '../../../../components/ui/button';
import { Dialog } from '../../../../components/ui/dialog';
import { SqlPreview } from '../../../components/sqlPreview';
import type { PreviewState } from './dataTable';
import { RowField } from './rowField';

export function RowDialog({ preview }: { preview: PreviewState }) {
	const data=preview.data!;
	const dialog=preview.dialog!;
	const columns=data.columnInfo.filter(
		column => column.editable&&!(dialog.mode==='insert'&&column.autoIncrement),
	);
	return (
		<Dialog open title={dialog.mode==='insert'? 'Insert row':'Edit row'}
			onClose={preview.closeDialog}
			actions={
				dialog.sql? (
					<>
						<Button
							variant="plain"
							onClick={preview.backToFields}
						>
							Back
						</Button>
						<Button onClick={preview.confirm}>Execute</Button>
					</>
				):(
					<Button onClick={preview.preview}>Review SQL</Button>
				)
			}
		>
			{dialog.sql? (
				<SqlPreview sql={dialog.sql} />
			):(
				<div className="grid gap-3">
					{columns.map(column => (
						<RowField key={column.name} column={column} preview={preview} />
					))}
				</div>
			)}
		</Dialog>
	);
}
