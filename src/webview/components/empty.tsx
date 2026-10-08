import { Icon } from './icons';

type EmptyStateProps = {
  label: string;
  title: string;
  description: string;
  icon: string;
};

export function Empty({ label, title, description, icon }: EmptyStateProps) {
  return (
    <section className="grid min-w-0 justify-items-center gap-2 px-4 py-6 text-center" aria-label={label}>
      <div className="grid size-8 place-items-center" aria-hidden="true">
        <Icon name={icon} size="xl" variant="muted" />
      </div>
      <h2 className="max-w-full break-words text-sm font-semibold">{title}</h2>
      <p className="max-w-lg break-words text-xs text-(--vscode-descriptionForeground)">{description}</p>
    </section>
  );
}
