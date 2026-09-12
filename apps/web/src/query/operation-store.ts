import type { Operation } from '../domain/git-action';

export type OperationStore = {
  get: (key: string) => Operation | null;
  set: (key: string, operation: Operation | null) => void;
  subscribe: (listener: () => void) => () => void;
};

// Git operations are connection-scoped, not server data: an uncertain request ID
// must survive navigation so the outcome can be recovered, and must disappear
// with the connection that produced it. A store owned by the connection gives
// both without parking non-server state in the Query cache.
export function createOperationStore(): OperationStore {
  const operations = new Map<string, Operation | null>();
  const listeners = new Set<() => void>();
  return {
    get: (key) => operations.get(key) ?? null,
    set(key, operation) {
      if ((operations.get(key) ?? null) === operation) return;
      operations.set(key, operation);
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
