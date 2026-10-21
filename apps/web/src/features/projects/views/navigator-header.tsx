import { UpdatesMenu } from '@/features/access/index';
import type { ReactNode } from 'react';

export function NavigatorHeader({
  environment,
  children,
}: {
  environment: string;
  children?: ReactNode;
}) {
  return (
    <header className="desktop-sidebar-header flex h-11 shrink-0 items-center gap-2 border-b px-3">
      <div className="flex min-w-0 flex-col leading-tight">
        <span className="text-sm font-semibold">Porcelain</span>
        <span
          className="truncate text-2xs text-muted-foreground"
          title={`Connected to ${environment}`}
        >
          {environment}
        </span>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        {children && <UpdatesMenu />}
        {children}
      </div>
    </header>
  );
}
