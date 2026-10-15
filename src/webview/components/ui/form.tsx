import { Field } from '@base-ui/react/field';
import { cn } from 'cn';
import type { ComponentProps, ReactElement, ReactNode } from 'react';

export { Form } from '@base-ui/react/form';

type FormItemProps = Omit<ComponentProps<typeof Field.Root>, 'children'> & {
  label?: ReactNode;
  error?: ReactNode;
  match?: ComponentProps<typeof Field.Error>['match'];
  control?: {
    value: string;
    onValueChange: (value: string) => void;
    required?: boolean;
  };
  children: ReactNode;
};

export function FormItem({ label, error, match, control, className, children, ...props }: FormItemProps) {
  return (
    <Field.Root {...props} className={cn('grid gap-1', className)}>
      {label != null && <Field.Label className="font-medium">{label}</Field.Label>}
      {control ? <Field.Control {...control} render={children as ReactElement} /> : children}
      {error != null && (
        <Field.Error match={match} className="text-(--vscode-errorForeground)">
          {error}
        </Field.Error>
      )}
    </Field.Root>
  );
}
