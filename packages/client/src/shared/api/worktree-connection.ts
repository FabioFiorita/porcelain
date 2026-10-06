import { Atom, Reactivity } from 'effect/reactivity';
import { Equal, Layer, ManagedRuntime } from 'effect';
import { WriteQueues } from './write-queue.ts';
import { ReadSubscriptions } from './read-subscriptions.ts';
import type { RuntimeConnection, WorktreeConnection } from './connection.ts';

export function createWorktreeConnection<R = never>(
  input: Omit<WorktreeConnection, 'request'> & { timeoutMs: number },
  memoMap: Layer.MemoMap | undefined,
  services: Layer.Layer<R, never>,
) {
  const controller = new AbortController();
  const { timeoutMs, ...context } = input;
  const runtime = ManagedRuntime.make(
    Layer.mergeAll(
      Layer.fresh(WriteQueues.layer),
      Reactivity.layer,
      Layer.fresh(ReadSubscriptions.layer),
      services,
    ),
    { memoMap },
  );
  const atoms = Atom.context({ memoMap: runtime.memoMap });
  const close = () => {
    controller.abort();
    return runtime.dispose();
  };
  controller.signal.addEventListener(
    'abort',
    () => {
      void runtime.dispose();
    },
    { once: true },
  );
  const connection = Equal.byReference<RuntimeConnection<R>>({
    runtime,
    atoms,
    close,
    ...context,
    request: (signal) => ({
      signal: AbortSignal.any([
        controller.signal,
        AbortSignal.timeout(timeoutMs),
        ...(signal ? [signal] : []),
      ]),
    }),
  });
  return { connection, controller, close };
}
