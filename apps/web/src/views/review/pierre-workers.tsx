import { WorkerPoolContextProvider } from '@pierre/diffs/react';
import type { ReactNode } from 'react';
import { PIERRE_THEME } from '../../lib/pierre';

/** Highlights code off the main thread so large reviews stay responsive. */
export function PierreWorkers({ children }: { children: ReactNode }) {
  return (
    <WorkerPoolContextProvider
      poolOptions={{
        poolSize: 4,
        workerFactory: () =>
          new Worker(
            new URL('@pierre/diffs/worker/worker.js', import.meta.url),
            { type: 'module' },
          ),
      }}
      highlighterOptions={{ theme: PIERRE_THEME }}
    >
      {children}
    </WorkerPoolContextProvider>
  );
}
