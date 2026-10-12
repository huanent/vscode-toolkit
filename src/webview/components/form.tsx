import { Field } from '@base-ui/react/field';
import { Form as BaseForm } from '@base-ui/react/form';
import type { ComponentProps, ReactElement, ReactNode } from 'react';
import { cn } from 'cn';

type FormProps = ComponentProps<typeof BaseForm>;

interface FormItemProps extends Omit<ComponentProps<typeof Field.Root>, 'children'> {
  label?: ReactNode;
  error?: ReactNode;
  match?: ComponentProps<typeof Field.Error>['match'];
  control?: {
    value: string;
    onValueChange: (value: string) => void;
    required?: boolean;
  };
  children: ReactNode;
}

export function Form(props: FormProps) {
  return <BaseForm {...props} />;
}

export function FormItem({ label, error, match, control, className, children, ...props }: FormItemProps) {
  return (
    <Field.Root {...props} className={cn('grid gap-1', className)}>
      {label && <Field.Label className="text-xs font-medium">{label}</Field.Label>}
      {control ? <Field.Control {...control} render={children as ReactElement} /> : children}
      {error && (
        <Field.Error match={match} className="text-xs text-(--vscode-errorForeground)">
          {error}
        </Field.Error>
      )}
    </Field.Root>
  );
}
