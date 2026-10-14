import { cn } from 'cn';
import type { TextareaHTMLAttributes } from 'react';
import { fieldClassName } from '@/webview/components/surface-styles';

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Textarea({ className, ...props }: TextareaProps) {
  return <textarea className={cn(fieldClassName, 'h-auto min-h-24 resize-y p-2', className)} {...props} />;
}
