import { Input as BaseInput } from '@base-ui/react/input';
import type { InputProps as BaseInputProps } from '@base-ui/react/input';
import type { ReactNode } from 'react';
import { cn } from 'cn';

export type InputProps = BaseInputProps & {
  startSlot?: ReactNode;
  endSlot?: ReactNode;
};

export function Input({ className, startSlot, endSlot, ...props }: InputProps) {
  const hasStartSlot = startSlot != null;
  const hasEndSlot = endSlot != null;
  const input = (
    <BaseInput
      className={cn(
        'h-7 w-full min-w-0 rounded-sm border border-(--vscode-input-border,transparent) bg-(--vscode-input-background) px-2 text-xs text-(--vscode-input-foreground) placeholder:text-(--vscode-input-placeholderForeground) focus:border-(--vscode-focusBorder) focus:outline-none aria-invalid:border-(--vscode-inputValidation-errorBorder) disabled:cursor-not-allowed disabled:opacity-50',
        hasStartSlot && 'pl-7',
        hasEndSlot && 'pr-7',
        className,
      )}
      {...props}
    />
  );

  if (!hasStartSlot && !hasEndSlot) return input;

  return (
    <div className="relative w-full min-w-0">
      {input}
      {hasStartSlot && (
        <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center" aria-hidden="true">
          {startSlot}
        </span>
      )}
      {hasEndSlot && (
        <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center" aria-hidden="true">
          {endSlot}
        </span>
      )}
    </div>
  );
}
