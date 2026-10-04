import type { WorktreeConnection } from './connection.ts';

export function createWorktreeConnection(
  input: Omit<WorktreeConnection, 'request'> & { timeoutMs: number },
) {
  const controller = new AbortController();
  const { timeoutMs, ...context } = input;
  const connection: WorktreeConnection = {
    ...context,
    request: (signal) => ({
      signal: AbortSignal.any([
        controller.signal,
        AbortSignal.timeout(timeoutMs),
        ...(signal ? [signal] : []),
      ]),
    }),
  };
  return { connection, controller, close: () => controller.abort() };
}
