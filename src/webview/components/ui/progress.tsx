import type { ComponentProps } from 'react';
import { cn } from 'cn';
import './progress.css';

type ProgressProps = Omit<ComponentProps<'progress'>, 'style'> & {
  animated?: boolean;
};

export function Progress({ animated = false, className, ...props }: ProgressProps) {
  return (
    <progress
      {...props}
      data-animated={animated}
      className={cn(
        'ui-progress pointer-events-none h-px w-full appearance-none border-0 bg-(--vscode-panel-border) text-(--vscode-progressBar-background) [&::-moz-progress-bar]:bg-current [&::-webkit-progress-bar]:bg-(--vscode-panel-border) [&::-webkit-progress-value]:bg-current',
        className,
      )}
    />
  );
}