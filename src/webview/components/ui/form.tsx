import { Field } from '@base-ui/react/field';
import { cn } from 'cn';
import { isValidElement, useState, type ComponentProps, type ReactElement, type ReactNode } from 'react';

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

export function FormItem({
  label,
  error,
  match,
  control,
  className,
  children,
  invalid,
  onBlurCapture,
  onInvalidCapture,
  ...props
}: FormItemProps) {
  const [showError, setShowError] = useState(false);
  const required = control
    ? control.required
    : isValidElement<{ required?: boolean }>(children) && children.props.required;

  return (
    <Field.Root
      {...props}
      invalid={showError ? invalid : undefined}
      onBlurCapture={(event) => {
        setShowError(true);
        onBlurCapture?.(event);
      }}
      onInvalidCapture={(event) => {
        setShowError(true);
        onInvalidCapture?.(event);
      }}
      className={cn('grid gap-1', className)}
    >
      {label != null && (
        <Field.Label className="font-medium">
          {required && (
            <span aria-hidden="true" className="mr-1 text-(--vscode-errorForeground)">
              *
            </span>
          )}
          {label}
        </Field.Label>
      )}
      {control ? <Field.Control {...control} render={children as ReactElement} /> : children}
      <div className="-mt-1 min-h-4 text-sm leading-4 text-(--vscode-errorForeground)">
        {showError && error != null && <Field.Error match={match}>{error}</Field.Error>}
      </div>
    </Field.Root>
  );
}
