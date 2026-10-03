import { WorkerPoolContextProvider } from '@pierre/diffs/react';
import type { ReactNode } from 'react';
import { PIERRE_WORKER_POOL_SIZE } from '@/config/limits';
import { PIERRE_THEME } from '@/shared/lib/pierre';

export function PierreWorkers({ children }: { children: ReactNode }) {
  return (
    <WorkerPoolContextProvider
      poolOptions={{
        poolSize: PIERRE_WORKER_POOL_SIZE,
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
