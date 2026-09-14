import { cn } from 'cn';
import type { ComponentPropsWithRef } from 'react';

export type SwitchProps = Omit<ComponentPropsWithRef<'input'>, 'type' | 'role' | 'size' | 'children'>;

export function Switch({ className, ...props }: SwitchProps) {
    return (
        <input
            {...props}
            type="checkbox"
            role="switch"
            className={cn(
                'relative m-0 inline-block h-5 w-9 shrink-0 cursor-pointer appearance-none rounded-full border border-(--vscode-contrastBorder,var(--vscode-checkbox-border)) bg-(--vscode-checkbox-background) align-middle outline-none',
                'before:absolute before:top-0.5 before:left-0.5 before:h-3.5 before:w-3.5 before:rounded-full before:bg-(--vscode-checkbox-foreground) before:content-[\'\']',
                'checked:border-(--vscode-contrastBorder,var(--vscode-button-background)) checked:bg-(--vscode-button-background) checked:before:translate-x-4 checked:before:bg-(--vscode-button-foreground)',
                'focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-(--vscode-focusBorder) disabled:cursor-default disabled:opacity-45',
                'motion-safe:transition-colors motion-safe:duration-150 motion-safe:before:transition-transform motion-safe:before:duration-150',
                className,
            )}
        />
    );
}