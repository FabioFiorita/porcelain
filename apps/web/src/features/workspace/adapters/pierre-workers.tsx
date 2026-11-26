import { WorkerPoolContext } from '@pierre/diffs/react';
import { WorkerPoolManager } from '@pierre/diffs/worker';
import { useState, type ReactNode } from 'react';
import { PIERRE_WORKER_POOL_SIZE } from '@/config/limits';
import { PIERRE_HIGHLIGHTER, PIERRE_THEME } from '@/shared/lib/pierre';

function createPool() {
  return new WorkerPoolManager(
    {
      poolSize: PIERRE_WORKER_POOL_SIZE,
      workerFactory: () =>
        new Worker(new URL('./pierre-worker.ts', import.meta.url), {
          type: 'module',
        }),
    },
    { theme: PIERRE_THEME, preferredHighlighter: PIERRE_HIGHLIGHTER },
  );
}

export function PierreWorkers({ children }: { children: ReactNode }) {
  const [pool, setPool] = useState<WorkerPoolManager>();
  const [attach] = useState(() => (element: HTMLDivElement | null) => {
    if (!element) return;
    const next = createPool();
    setPool(next);
    return () => next.terminate();
  });
  return (
    <div ref={attach} className="contents">
      {pool && <WorkerPoolContext value={pool}>{children}</WorkerPoolContext>}
    </div>
  );
}
