import { Icon } from '@/webview/components/ui/icons';

type EmptyProps = {
  icon: string;
  title: string;
  description?: string;
};

export function Empty({ icon, title, description }: EmptyProps) {
  return (
    <section className="grid min-w-0 justify-items-center gap-2 px-4 py-6 text-center" aria-label={title}>
      <div className="grid size-8 place-items-center" aria-hidden="true">
        <Icon name={icon} size="3xl" variant="muted" />
      </div>
      <h2 className="max-w-full wrap-break-word font-semibold">{title}</h2>
      {description && (
        <p className="text-xs max-w-lg wrap-break-word text-(--vscode-descriptionForeground)">{description}</p>
      )}
    </section>
  );
}
