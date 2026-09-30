import { Icon } from './icons';

type EmptyStateProps = {
  label: string;
  title: string;
  description: string;
  icon: string;
};

export function Empty({ label, title, description, icon }: EmptyStateProps) {
  return (
    <section
      className="mt-13 grid justify-items-center border border-dashed border-(--vscode-panel-border) px-4 py-6 text-center"
      aria-label={label}
    >
      <div className="mb-3 grid size-10 place-items-center " aria-hidden="true">
        <Icon name={icon} size="lg" />
      </div>
      <h2 className="mb-2 text-base font-semibold">{title}</h2>
      <p className="max-w-3xl text-sm text-(--vscode-descriptionForeground)">{description}</p>
    </section>
  );
}
