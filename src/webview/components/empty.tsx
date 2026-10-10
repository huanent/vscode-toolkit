import { cn } from 'cn';
import type { ComponentPropsWithRef, ReactNode } from 'react';

export type EmptyProps = Omit<ComponentPropsWithRef<'section'>, 'title' | 'children'> & {
  label?: string;
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  titleAs?: 'h1' | 'h2' | 'h3' | 'strong';
  titleClassName?: string;
  descriptionClassName?: string;
};

export function Empty({
  label,
  title,
  description,
  icon,
  titleAs: Title = 'h2',
  className,
  titleClassName,
  descriptionClassName,
  ...props
}: EmptyProps) {
  return (
    <section
      className={cn('grid min-w-0 justify-items-center gap-2 px-4 py-6 text-center', className)}
      aria-label={label}
      {...props}
    >
      {icon != null && <div className="grid size-8 place-items-center" aria-hidden="true">{icon}</div>}
      <Title className={cn('max-w-full break-words text-sm font-semibold', titleClassName)}>{title}</Title>
      {description != null && (
        <p className={cn('max-w-lg break-words text-xs text-(--vscode-descriptionForeground)', descriptionClassName)}>
          {description}
        </p>
      )}
    </section>
  );
}
