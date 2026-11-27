import type { ReactNode } from 'react';
import { TruncatedText } from '@/shared/views/truncated-text';
import { WindowDragRegion } from '@/shared/views/window-drag-region';

export function NavigatorHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="desktop-sidebar-header relative mt-0.5 flex h-10 shrink-0 items-center gap-2 px-2">
      <WindowDragRegion />
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
