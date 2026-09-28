type EmptyStateProps = {
  label: string;
  title: string;
  description: string;
  icon: string;
};

export function EmptyState({ label, title, description, icon }: EmptyStateProps) {
  return (
    <section
      className="mt-13 grid justify-items-center border border-dashed border-(--vscode-panel-border) px-4 py-6 text-center"
      aria-label={label}
    >
      <div
        className="mb-4 grid size-10 place-items-center bg-(--vscode-textLink-foreground)/15 text-xl text-(--vscode-textLink-foreground)"
        aria-hidden="true"
      >
        {icon}
      </div>
      <h2 className="mb-2 text-base font-semibold">{title}</h2>
      <p className="max-w-3xl leading-normal text-(--vscode-descriptionForeground)">{description}</p>
    </section>
  );
}
