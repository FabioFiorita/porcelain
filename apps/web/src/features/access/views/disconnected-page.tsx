import { ArrowUpRightIcon } from 'lucide-react';
import { PorcelainLogo } from '@/shared/views/porcelain-logo';
import type { ReactNode } from 'react';

export function DisconnectedPage({ children }: { children: ReactNode }) {
  return (
    <div className="pairing-page flex min-h-svh flex-col bg-background">
      <header className="flex h-16 shrink-0 items-center gap-2 px-6 md:px-8">
        <PorcelainLogo className="size-6" />
        <h1 className="text-lg font-medium tracking-tight">Porcelain</h1>
        <a
          href="https://porcelain.fabiofiorita.com/install"
          target="_blank"
          rel="noreferrer"
          className="ml-auto inline-flex items-center gap-1 rounded-md p-1 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          Install guide{' '}
          <ArrowUpRightIcon aria-hidden="true" className="size-3.5" />
        </a>
      </header>
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-6 pb-7 pt-10 md:px-14 md:pt-14">
        {children}
      </main>
    </div>
  );
}
