import type { ReactNode } from 'react';

/**
 * The page frame for every screen shown before this browser has access: the
 * not-paired screen and the pairing link's own page.
 *
 * It exists so those screens are not the only ones in the application without
 * a heading, a gutter or a full-height surface — a pairing link that fails is
 * the first thing a new owner sees.
 */
export function DisconnectedPage({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="absolute right-4 top-3">
        <h1 className="font-medium">Porcelain</h1>
      </div>
      <main className="mx-auto flex min-h-svh max-w-6xl flex-col items-start gap-6 px-6 py-24">
        {children}
      </main>
    </>
  );
}
