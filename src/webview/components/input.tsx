import { Input as BaseInput, type InputProps as BaseInputProps } from '@base-ui/react/input';
import { cn } from 'cn';
import type { ReactNode } from 'react';
import { fieldClassName } from '@/webview/components/surface-styles';

export type InputProps = Omit<BaseInputProps, 'prefix'> & {
  prefix?: ReactNode;
  suffix?: ReactNode;
};

export function Input({ className, prefix, suffix, ...props }: InputProps) {
  if (prefix == null && suffix == null) {
    return <BaseInput className={cn(fieldClassName, className)} {...props} />;
  }

  return (
    <div
      className={cn(
        'flex h-6 w-full min-w-0 items-center gap-2 rounded-sm border border-(--vscode-input-border,transparent) bg-(--vscode-input-background) px-2 text-(--vscode-input-foreground) focus-within:border-(--vscode-focusBorder) has-aria-invalid:border-(--vscode-inputValidation-errorBorder)',
        props.disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      {prefix != null && <div className="inline-flex shrink-0 items-center">{prefix}</div>}
      <BaseInput
        className={cn(
          'h-full min-w-0 flex-1 bg-transparent p-0 placeholder:text-(--vscode-input-placeholderForeground) focus:outline-none disabled:opacity-100',
          className,
        )}
        {...props}
      />
      {suffix != null && <div className="inline-flex shrink-0 items-center">{suffix}</div>}
    </div>
  );
}
