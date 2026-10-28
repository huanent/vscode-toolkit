import { cn } from 'cn';
import type { ComponentPropsWithRef } from 'react';
import { fieldClassName } from '@/webview/components/ui/surface-styles';

export type TextareaProps = ComponentPropsWithRef<'textarea'>;

export function Textarea({ className, ...props }: TextareaProps) {
  return <textarea className={cn(fieldClassName, 'h-auto min-h-24 resize-y p-2', className)} {...props} />;
}
