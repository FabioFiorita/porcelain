import type { ComponentProps, MouseEvent, ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';

export const settingsSectionAttribute = 'data-settings-section';

export function plainClick(event: MouseEvent<HTMLAnchorElement>) {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

export function SettingsSection({
  id,
  title,
  count,
  action,
  disabled,
  className,
  children,
}: {
  id: string;
  title: string;
  count?: number | undefined;
  action?: ReactNode;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const heading = `${id}-heading`;
  return (
    <fieldset
      id={id}
      {...{ [settingsSectionAttribute]: title }}
      aria-labelledby={heading}
      disabled={disabled}
      tabIndex={-1}
      className={cn(
        'flex min-w-0 scroll-mt-5 flex-col gap-2 outline-none',
        className,
      )}
    >
      <div className="flex min-h-7 flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h2
          id={heading}
          className="flex items-baseline gap-1.5 text-sm leading-5 font-semibold"
        >
          {title}
          {count !== undefined && (
            <span className="text-xs font-normal text-muted-foreground tabular-nums">
              {count}
            </span>
          )}
        </h2>
        {action && (
          <div className="flex flex-wrap items-center gap-2">{action}</div>
        )}
      </div>
      {children}
    </fieldset>
  );
}

export function SettingsGroup({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      role="list"
      data-slot="settings-group"
      className={cn(
        'flex w-full flex-col rounded-lg border bg-card empty:hidden *:data-[slot=item]:rounded-none *:data-[slot=item]:border-0 *:data-[slot=item]:border-border *:data-[slot=item]:not-first:border-t',
        className,
      )}
      {...props}
    />
  );
}
