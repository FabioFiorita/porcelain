import type { ReactNode } from 'react';

export function SectionHeading({
  id,
  children,
  aside,
}: {
  id?: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-1 border-b pb-2.5">
      <h3 id={id} className="min-w-0 text-section font-semibold">
        {children}
      </h3>
      {aside !== undefined && (
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {aside}
        </span>
      )}
    </div>
  );
}
