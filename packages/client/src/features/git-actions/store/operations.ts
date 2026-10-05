import { Effect, Result, Schema } from 'effect';
import { ConnectionError } from '../../../shared/api/connection-error.ts';
import { currentAnswerEffect } from '../../../shared/api/stale-answer.ts';
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
  const parsedScope = Schema.decodeUnknownResult(worktreeParamsSchema)({
    worktreeId: candidate.worktreeId,
  });
  const request = Schema.decodeUnknownResult(runGitActionRequestSchema)(
    candidate.request,
  );
  if (
    Result.isFailure(parsedScope) ||
    Result.isFailure(request) ||
    typeof candidate.projectId !== 'string' ||
    candidate.projectId.length === 0 ||
    candidate.requestId !== request.success.requestId
  )
    return null;
  return {
    ...parsedScope.success,
    projectId: candidate.projectId,
    requestId: request.success.requestId,
    request: request.success,
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
  storage: {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
  };
  key: string;
};
export function createOperationStore(persistence?: Persistence) {
  let operations = new Map<string, Operation>();
  let restorationError: ConnectionError | undefined;
  const lifetime = new AbortController();
  if (persistence) {
    try {
      const saved: unknown = JSON.parse(
        persistence.storage.getItem(persistence.key) ?? '[]',
      );
      if (!Array.isArray(saved))
        throw new Error('Expected retained operations');
      for (const entry of saved) {
        const operation = parseRetainedOperation(entry);
        if (!operation) throw new Error('Invalid retained operation');
        operations.set(
          operationKey(operation, operation.request.input.action),
          operation,
        );
      }
    } catch (cause) {
      restorationError =
        cause instanceof ConnectionError
          ? cause
          : new ConnectionError({
              message:
                'Could not restore pending Git operations. Check the previous operation before starting another.',
              cause,
            });
      operations.clear();
    }
  }
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };
  const commit = (next: Map<string, Operation>) =>
    Effect.andThen(
      currentAnswerEffect(lifetime.signal),
      Effect.try({
        try: () => {
          if (restorationError) throw restorationError;
          if (!persistence) return;
          const pending = [...next.values()]
            .filter((entry) => !entry.receipt || !isTerminal(entry.receipt))
            .map((entry) => ({
              ...entry,
              request: Schema.encodeSync(runGitActionRequestSchema)(
                entry.request,
              ),
            }));
          if (pending.length)
            persistence.storage.setItem(
              persistence.key,
              JSON.stringify(pending),
            );
          else persistence.storage.removeItem(persistence.key);
        },
        catch: (cause) =>
          cause instanceof ConnectionError
            ? cause
            : new ConnectionError({
                message:
                  'Could not save the Git operation. Check device storage before trying again.',
                cause,
              }),
      }),
    ).pipe(
      Effect.andThen(
        Effect.sync(() => {
          operations = next;
          notify();
        }),
      ),
      Effect.uninterruptible,
    );
  const store = {
    close() {
      lifetime.abort();
      operations.clear();
      notify();
      listeners.clear();
    },
    get: (key: string) => operations.get(key) ?? null,
    list: () => [...operations.values()],
    set(
      key: string,
      operation: Operation | null,
    ): Effect.Effect<void, ConnectionError> {
      return Effect.suspend(() => {
        const next = new Map(operations);
        if (operation) next.set(key, operation);
        else next.delete(key);
        return commit(next);
      });
    },
    accept(receipt: Receipt): Effect.Effect<boolean, ConnectionError> {
      return Effect.suspend(() => {
        const key = operationKey(receipt, receipt.action);
        const current = operations.get(key);
        if (
          !current ||
          current.requestId !== receipt.requestId ||
          (current.receipt && isTerminal(current.receipt))
        )
          return Effect.succeed(false);
        const next = new Map(operations);
        next.set(key, { ...current, receipt });
        return Effect.as(commit(next), true);
      });
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    wait(
      key: string,
      requestId: string,
    ): Effect.Effect<Receipt, ConnectionError> {
      return Effect.callback((resume, signal) => {
        const check = () => {
          const current = operations.get(key);
          if (current?.requestId !== requestId) {
            resume(
              Effect.andThen(currentAnswerEffect(signal, false), Effect.never),
            );
            return;
          }
          const receipt = current.receipt;
          if (receipt && isTerminal(receipt)) {
            resume(Effect.succeed(receipt));
          }
        };
        listeners.add(check);
        check();
        return Effect.sync(() => {
          listeners.delete(check);
        });
      });
    },
  };
  return store;
}
export type OperationStore = ReturnType<typeof createOperationStore>;
