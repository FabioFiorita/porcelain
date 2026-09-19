import type { GitAction, Receipt } from '../contracts/git-actions';

/**
 * A Git action in flight. Its progress lines and its end arrive on the live
 * channel, so the operation lives beside the connection, not in the query cache,
 * and outlives the component that started it.
 */
export type Operation = {
  requestId: string;
  projectId: string;
  worktreeId: string;
  action: GitAction;
  progress: string[];
  receipt?: Receipt;
};

export function createOperationStore() {
  const operations = new Map<string, Operation>();
  const waiters = new Map<string, (receipt: Receipt) => void>();
  const listeners = new Set<() => void>();
  let snapshot: Operation[] = [];
  const notify = () => {
    snapshot = [...operations.values()];
    for (const listener of listeners) listener();
  };
  return {
    list: () => snapshot,
    get: (requestId: string) => operations.get(requestId),
    start(operation: Operation) {
      operations.set(operation.requestId, operation);
      notify();
    },
    progress(requestId: string, line: string) {
      const operation = operations.get(requestId);
      if (operation == null || operation.progress.includes(line)) return;
      operations.set(requestId, {
        ...operation,
        progress: [...operation.progress, line],
      });
      notify();
    },
    /** Records the final receipt and wakes whoever waits for it. */
    finish(receipt: Receipt) {
      const operation = operations.get(receipt.requestId);
      if (operation != null)
        operations.set(receipt.requestId, {
          ...operation,
          receipt,
          progress: receipt.progress,
        });
      notify();
      waiters.get(receipt.requestId)?.(receipt);
      waiters.delete(receipt.requestId);
    },
    /** Resolves when the live channel reports the action finished. */
    wait(requestId: string): Promise<Receipt> {
      return new Promise((resolve) => waiters.set(requestId, resolve));
    },
    /** Operations still running, re-checked after a reconnect. */
    running: () =>
      [...operations.values()].filter((operation) => operation.receipt == null),
    remove(requestId: string) {
      operations.delete(requestId);
      notify();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export type OperationStore = ReturnType<typeof createOperationStore>;
