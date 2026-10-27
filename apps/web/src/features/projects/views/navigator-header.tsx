import type { ReactNode } from 'react';

export function NavigatorHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="desktop-sidebar-header flex h-11 shrink-0 items-center gap-2 px-3">
      <div className="flex min-w-0 flex-col leading-tight">
        <span className="text-sm font-semibold tracking-tight">Porcelain</span>
      </div>
      {children}
    </header>
  );
}
