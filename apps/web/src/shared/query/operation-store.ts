import {
  runGitActionRequestSchema,
  type RunGitActionRequest,
  type RunGitActionResponse,
} from '@porcelain/contracts/git-actions';
import { worktreeParamsSchema } from '@porcelain/contracts/shared';

type Receipt = RunGitActionResponse;
type Operation = {
  requestId: string;
  projectId: string;
  worktreeId: string;
  request: RunGitActionRequest;
  receipt?: Receipt;
};

function parseRetainedOperation(value: unknown): Operation | null {
  if (!isRecord(value)) return null;
  const candidate = value;
  const parsedScope = worktreeParamsSchema.safeParse({
    projectId: candidate.projectId,
    worktreeId: candidate.worktreeId,
  });
  const request = runGitActionRequestSchema.safeParse(candidate.request);
  if (
    !parsedScope.success ||
    !request.success ||
    typeof candidate.projectId !== 'string' ||
    candidate.projectId.length === 0 ||
    candidate.requestId !== request.data.requestId
  )
    return null;
  return {
    ...parsedScope.data,
    projectId: candidate.projectId,
    requestId: request.data.requestId,
    request: request.data,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isTerminal(receipt: Receipt) {
  return receipt.state !== 'running';
}
export const operationKey = (
  scope: { projectId: string; worktreeId: string },
  action: string,
) => JSON.stringify([scope.projectId, scope.worktreeId, action]);

type Persistence = {
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  key: string;
};
export function createOperationStore(persistence?: Persistence) {
  const operations = new Map<string, Operation>();
  if (persistence) {
    try {
      const saved: unknown = JSON.parse(
        persistence.storage.getItem(persistence.key) ?? '[]',
      );
      if (Array.isArray(saved))
        for (const entry of saved) {
          const operation = parseRetainedOperation(entry);
          if (operation)
            operations.set(
              operationKey(operation, operation.request.input.action),
              operation,
            );
        }
    } catch {
      operations.clear();
    }
  }
  const persist = () => {
    if (!persistence) return;
    try {
      const pending = [...operations.values()].filter(
        (entry) => !entry.receipt || !isTerminal(entry.receipt),
      );
      if (pending.length)
        persistence.storage.setItem(persistence.key, JSON.stringify(pending));
      else persistence.storage.removeItem(persistence.key);
    } catch {
      return;
    }
  };
  const listeners = new Set<() => void>();
  const notify = () => {
    persist();
    for (const listener of listeners) listener();
  };
  const store = {
    clear() {
      operations.clear();
      notify();
    },
    get: (key: string) => operations.get(key) ?? null,
    list: () => [...operations.values()],
    set(key: string, operation: Operation | null) {
      if (operation) operations.set(key, operation);
      else operations.delete(key);
      notify();
    },
    accept(receipt: Receipt) {
      const key = operationKey(receipt, receipt.action);
      const current = operations.get(key);
      if (!current || current.requestId !== receipt.requestId) return false;
      if (current.receipt && isTerminal(current.receipt)) return false;
      operations.set(key, { ...current, receipt });
      notify();
      return true;
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    wait(key: string, signal: AbortSignal): Promise<Receipt> {
      return new Promise((resolve, reject) => {
        const cleanup = () => {
          listeners.delete(check);
          signal.removeEventListener('abort', abort);
        };
        const abort = () => {
          cleanup();
          reject(signal.reason);
        };
        const check = () => {
          const receipt = operations.get(key)?.receipt;
          if (receipt && isTerminal(receipt)) {
            cleanup();
            resolve(receipt);
          }
        };
        listeners.add(check);
        signal.addEventListener('abort', abort, { once: true });
        if (signal.aborted) abort();
        else check();
      });
    },
  };
  return store;
}
export type OperationStore = ReturnType<typeof createOperationStore>;
