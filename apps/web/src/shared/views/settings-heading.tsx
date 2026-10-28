import type { ReactNode } from 'react';

export function SettingsHeading({
  section,
  title,
  lead,
  status,
  action,
  children,
}: {
  section: string;
  title: ReactNode;
  lead: ReactNode;
  status?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col">
      {status && (
        <div className="mb-1.5 flex h-5.5 min-w-0 items-center gap-2 text-ui leading-4.5">
          {status}
        </div>
      )}
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        <h1 className="min-w-0 text-4xl font-semibold tracking-title wrap-anywhere">
          <span className="text-title-dim">{section}.</span> {title}
        </h1>
        {action}
      </div>
      <p className="mt-3 max-w-160 text-base tracking-lead text-foreground-2">
        {lead}
      </p>
      {children}
    </div>
  );
}
