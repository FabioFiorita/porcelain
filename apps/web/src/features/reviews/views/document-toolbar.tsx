import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';

export function DocumentToolbar({
  title,
  titleLabel,
  subtitle,
  children,
  className,
}: {
  title: ReactNode;
  titleLabel?: string;
  subtitle?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header
      data-testid="document-toolbar"
      className={cn(
        'flex min-h-11 shrink-0 flex-wrap items-center gap-x-2.5 gap-y-1 border-b px-3.5',
        className,
      )}
    >
      <div className="flex min-w-0 flex-auto flex-col">
        <h1
          aria-label={titleLabel}
          className="truncate text-[13px] leading-tight font-semibold"
        >
          {title}
        </h1>
        {subtitle != null && (
          <p className="truncate text-[11px] leading-tight text-muted-foreground">
            {subtitle}
          </p>
        )}
      </div>
      <div className="ml-auto flex max-w-full shrink-0 flex-wrap items-center justify-end gap-1.5">
        {children}
      </div>
    </header>
  );
}
