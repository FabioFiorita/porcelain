import { ManagedRuntime } from 'effect';
import { WriteQueues } from './write-queue.ts';
import type { RuntimeConnection, WorktreeConnection } from './connection.ts';

export function createWorktreeConnection(
  input: Omit<WorktreeConnection, 'request'> & { timeoutMs: number },
) {
  const controller = new AbortController();
  const { timeoutMs, ...context } = input;
  const runtime = ManagedRuntime.make(WriteQueues.layer);
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
  const connection: RuntimeConnection = {
    runtime,
    close,
    ...context,
    request: (signal) => ({
      signal: AbortSignal.any([
        controller.signal,
        AbortSignal.timeout(timeoutMs),
        ...(signal ? [signal] : []),
      ]),
    }),
  };
  return { connection, controller, close };
}
