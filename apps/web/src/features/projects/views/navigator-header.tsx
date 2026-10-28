import type { ReactNode } from 'react';
import { PorcelainLogo } from '@/shared/views/porcelain-logo';
import { TruncatedText } from '@/shared/views/truncated-text';

export function NavigatorHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="desktop-sidebar-header mt-0.5 flex h-10 shrink-0 items-center gap-2 pr-3 pl-2.5">
      <PorcelainLogo className="size-4.5" />
      <div className="flex min-w-0 flex-col leading-tight">
        <TruncatedText
          className="text-sm font-semibold tracking-tight"
          text="Porcelain"
        />
      </div>
      {children}
    </header>
  );
}
