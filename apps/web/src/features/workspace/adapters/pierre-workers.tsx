import {
  CodeView,
  WorkerPoolContext,
  useWorkerPool,
  type CodeViewHandle,
  type CodeViewProps,
} from '@pierre/diffs/react';
import { WorkerPoolManager } from '@pierre/diffs/worker';
import { useState, type ReactNode, type Ref } from 'react';
import { PIERRE_WORKER_POOL_SIZE } from '@/config/limits';
import {
  PIERRE_DECISION_THEME,
  PIERRE_HIGHLIGHTER,
  PIERRE_THEME,
} from '@/shared/lib/pierre';

const reviewPools = new WeakMap<WorkerPoolManager, WorkerPoolManager>();

function createPool(theme: typeof PIERRE_THEME | typeof PIERRE_DECISION_THEME) {
  return new WorkerPoolManager(
    {
      poolSize: PIERRE_WORKER_POOL_SIZE / 2,
      workerFactory: () =>
        new Worker(new URL('./pierre-worker.ts', import.meta.url), {
          type: 'module',
        }),
    },
    { theme, preferredHighlighter: PIERRE_HIGHLIGHTER },
  );
}

type Pools = { standard: WorkerPoolManager; review: WorkerPoolManager };

export function PierreWorkers({ children }: { children: ReactNode }) {
  const [pools, setPools] = useState<Pools>();
  const [attach] = useState(() => (element: HTMLDivElement | null) => {
    if (!element) return;
    const next = {
      standard: createPool(PIERRE_THEME),
      review: createPool(PIERRE_DECISION_THEME),
    };
    reviewPools.set(next.standard, next.review);
    setPools(next);
    return () => {
      reviewPools.delete(next.standard);
      next.standard.terminate();
      next.review.terminate();
    };
  });
  return (
    <div ref={attach} className="contents">
      {pools && (
        <WorkerPoolContext value={pools.standard}>{children}</WorkerPoolContext>
      )}
    </div>
  );
}

export function PierreCodeView<LAnnotation = undefined, Caret = undefined>({
  review,
  ...props
}: CodeViewProps<LAnnotation, Caret> & {
  review: boolean;
  ref?: Ref<CodeViewHandle<LAnnotation, Caret>>;
}) {
  const standard = useWorkerPool();
  const reviewPool = standard ? reviewPools.get(standard) : undefined;
  return (
    <WorkerPoolContext value={review ? reviewPool : standard}>
      <CodeView {...props} />
    </WorkerPoolContext>
  );
}
