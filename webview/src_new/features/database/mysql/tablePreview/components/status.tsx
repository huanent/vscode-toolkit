import { cn } from 'cn';
import {
	LoaderCircle
} from '../../../../../components/ui/icons';

export function Status({
	children,
	loading,
	error,
}: {
	children: React.ReactNode;
	loading?: boolean;
	error?: boolean;
}) {
	return (
		<div
			className={cn(
				'flex items-center justify-center gap-2 p-8',
				error? 'text-(--vscode-errorForeground)':'text-(--vscode-descriptionForeground)',
			)}
		>
			{loading&&<LoaderCircle className="animate-spin" size="md" />}
			{children}
		</div>
	);
}
