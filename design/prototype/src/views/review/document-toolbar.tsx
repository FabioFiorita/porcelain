import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function DocumentToolbar({
  title,
  subtitle,
  children,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    // A size container, so what the toolbar hides when narrow follows the pane, not the window.
    <header
      className={cn(
        '@container flex h-11 shrink-0 items-center gap-2.5 border-b px-3.5',
        className,
      )}
    >
      <div className="flex min-w-0 flex-col @max-md:min-w-20">
        <h1 className="truncate text-[13px] leading-tight font-semibold">
          {title}
        </h1>
        {subtitle != null && (
          <p className="truncate text-[11px] leading-tight text-muted-foreground">
            {subtitle}
          </p>
        )}
      </div>
      {/* On a phone the actions can outgrow the pane: they scroll sideways rather than clip. */}
      <div className="ml-auto flex min-w-0 items-center gap-1.5 overflow-x-auto [scrollbar-width:none]">
        {children}
      </div>
    </header>
  );
}
