import type { ReactNode } from 'react';

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
