import { Input as BaseInput } from '@base-ui/react/input';
import type { InputProps as BaseInputProps } from '@base-ui/react/input';
import type { ReactNode } from 'react';
import { cn } from 'cn';

export type InputProps = Omit<BaseInputProps, 'prefix'> & {
  prefix?: ReactNode;
  suffix?: ReactNode;
};

export function Input({ className, prefix, suffix, ...props }: InputProps) {
  const hasSlots = prefix != null || suffix != null;
  const input = (
    <BaseInput
      className={cn(
        'h-7 w-full min-w-0 rounded-sm border border-(--vscode-input-border,transparent) bg-(--vscode-input-background) px-2 text-xs text-(--vscode-input-foreground) placeholder:text-(--vscode-input-placeholderForeground) focus:border-(--vscode-focusBorder) focus:outline-none aria-invalid:border-(--vscode-inputValidation-errorBorder) disabled:cursor-not-allowed disabled:opacity-50',
        hasSlots && 'flex-1 border-0 bg-transparent px-0 disabled:opacity-100',
        className,
      )}
      {...props}
    />
  );

  if (!hasSlots) return input;

  return (
    <div
      className={cn(
        'flex w-full min-w-0 items-center gap-2 rounded-sm border border-(--vscode-input-border,transparent) bg-(--vscode-input-background) px-2 text-xs text-(--vscode-input-foreground) focus-within:border-(--vscode-focusBorder) has-aria-invalid:border-(--vscode-inputValidation-errorBorder)',
        props.disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      {prefix != null && <span className="inline-flex shrink-0 items-center">{prefix}</span>}
      {input}
      {suffix != null && <span className="inline-flex shrink-0 items-center">{suffix}</span>}
    </div>
  );
}
