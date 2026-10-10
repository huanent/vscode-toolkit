import type { ReactNode } from 'react';
import { cn } from 'cn';

export function Toolbar({
    title,
    children,
    className,
}: {
    title: string;
    children?: ReactNode;
    className?: string;
}) {
    return (
        <header className={cn('flex min-w-0 shrink-0 flex-wrap items-center justify-between gap-2', className)}>
            <h1 className="m-0 min-w-0 text-md font-semibold wrap-anywhere">
                {title}
            </h1>
            <div className="ml-auto flex flex-wrap items-center gap-0.5">{children}</div>
        </header>
    );
}