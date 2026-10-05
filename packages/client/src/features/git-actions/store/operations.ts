import {
  Context,
  Effect,
  Layer,
  Option,
  Result,
  Schema,
  Semaphore,
  Stream,
  SubscriptionRef,
} from 'effect';
import { AtomRef } from 'effect/reactivity';
import { ConnectionError } from '../../../shared/api/connection-error.ts';
import { currentContextEffect } from '../../../shared/api/stale-answer.ts';
import { OperationStorage } from '../ports/operation-storage.ts';
import {
  runGitActionRequestSchema,
  type RunGitActionRequest,
  type RunGitActionResponse,
} from '@porcelain/contracts/git-actions';
import { worktreeParamsSchema } from '@porcelain/contracts/shared';

type Receipt = RunGitActionResponse;
type Operation = {
  readonly requestId: string;
  readonly projectId: string;
  readonly worktreeId: string;
  readonly request: RunGitActionRequest;
  readonly receipt?: Receipt;
};
type State = {
  readonly operations: ReadonlyMap<string, Operation>;
  readonly closed: boolean;
  readonly restorationError: ConnectionError | undefined;
};
const retainedSchema = Schema.fromJsonString(
  Schema.Array(
    Schema.Struct({
      requestId: runGitActionRequestSchema.fields.requestId,
      projectId: Schema.String.check(Schema.isMinLength(1)),
      worktreeId: worktreeParamsSchema.fields.worktreeId,
      request: runGitActionRequestSchema,
    }).check(
      Schema.makeFilter(
        (operation) => operation.requestId === operation.request.requestId,
      ),
    ),
  ),
);

export function isTerminal(receipt: Receipt) {
  return receipt.state !== 'running';
}
export const operationKey = (
  scope: { projectId: string; worktreeId: string },
  action: string,
) => JSON.stringify([scope.projectId, scope.worktreeId, action]);

export class OperationStore extends Context.Service<
  OperationStore,
  {
    readonly state: AtomRef.ReadonlyRef<State>;
    readonly set: (
      key: string,
      operation: Operation | null,
    ) => Effect.Effect<void, ConnectionError>;
    readonly accept: (
      receipt: Receipt,
    ) => Effect.Effect<boolean, ConnectionError>;
    readonly wait: (
      key: string,
      requestId: string,
    ) => Effect.Effect<Receipt, ConnectionError>;
  }
>()('@porcelain/client/OperationStore') {
  static readonly layer = Layer.effect(
    OperationStore,
    Effect.gen(function* () {
      const storage = yield* OperationStorage;
      const mutex = yield* Semaphore.make(1);
      const changed = yield* SubscriptionRef.make(0);
      const restored = yield* storage.read().pipe(
        Effect.flatMap((text) =>
          Schema.decodeUnknownEffect(retainedSchema)(text ?? '[]'),
        ),
        Effect.result,
      );
      const state = AtomRef.make<State>({
        operations: Result.isSuccess(restored)
          ? new Map(
              restored.success.map((operation) => [
                operationKey(operation, operation.request.input.action),
                operation,
              ]),
            )
          : new Map(),
        closed: false,
        restorationError: Result.isFailure(restored)
          ? new ConnectionError({
              message:
                'Could not restore pending Git operations. Check the previous operation before starting another.',
              cause: restored.failure,
            })
          : undefined,
      });
      const publish = Effect.fn('OperationStore.publish')(function* (
        next: State,
      ) {
        state.set(next);
        yield* SubscriptionRef.update(changed, (revision) => revision + 1);
      });
      yield* Effect.addFinalizer(() =>
        mutex.withPermit(
          publish({ ...state.value, operations: new Map(), closed: true }),
        ),
      );
      const persist = Effect.fn('OperationStore.persist')(function* (
        operations: ReadonlyMap<string, Operation>,
      ) {
        if (state.value.restorationError)
          return yield* Effect.fail(state.value.restorationError);
        const pending = [...operations.values()]
          .filter(
            (operation) => !operation.receipt || !isTerminal(operation.receipt),
          )
          .map(({ receipt: _receipt, ...operation }) => operation);
        const text = yield* Schema.encodeEffect(retainedSchema)(pending).pipe(
          Effect.mapError(
            (cause) =>
              new ConnectionError({
                message:
                  'Could not save the Git operation. Check device storage before trying again.',
                cause,
              }),
          ),
        );
        yield* (pending.length ? storage.write(text) : storage.clear()).pipe(
          Effect.mapError(
            ({ cause }) =>
              new ConnectionError({
                message:
                  'Could not save the Git operation. Check device storage before trying again.',
                cause,
              }),
          ),
        );
        yield* publish({ ...state.value, operations });
      });
      const write = <A>(action: () => Effect.Effect<A, ConnectionError>) =>
        mutex.withPermit(
          Effect.gen(function* () {
            if (state.value.closed) return yield* Effect.interrupt;
            return yield* action().pipe(Effect.uninterruptible);
          }),
        );
      return {
        state,
        set: Effect.fn('OperationStore.set')(
          (key: string, operation: Operation | null) =>
            write(() =>
              Effect.gen(function* () {
                const next = new Map(state.value.operations);
                if (operation) next.set(key, operation);
                else next.delete(key);
                yield* persist(next);
              }),
            ),
        ),
        accept: Effect.fn('OperationStore.accept')((receipt: Receipt) =>
          write(() =>
            Effect.gen(function* () {
              const key = operationKey(receipt, receipt.action);
              const current = state.value.operations.get(key);
              if (
                !current ||
                current.requestId !== receipt.requestId ||
                (current.receipt && isTerminal(current.receipt))
              )
                return false;
              const next = new Map(state.value.operations);
              next.set(key, { ...current, receipt });
              yield* persist(next);
              return true;
            }),
          ),
        ),
        wait: Effect.fn('OperationStore.wait')(function* (
          key: string,
          requestId: string,
        ) {
          const result = yield* SubscriptionRef.changes(changed).pipe(
            Stream.mapEffect(() =>
              Effect.gen(function* () {
                const current = state.value.operations.get(key);
                yield* currentContextEffect(
                  !state.value.closed && current?.requestId === requestId,
                );
                return current?.receipt && isTerminal(current.receipt)
                  ? Option.some(current.receipt)
                  : Option.none();
              }),
            ),
            Stream.filter(Option.isSome),
            Stream.map((receipt) => receipt.value),
            Stream.runHead,
          );
          return yield* Option.match(result, {
            onSome: Effect.succeed,
            onNone: () =>
              currentContextEffect(false).pipe(Effect.andThen(Effect.never)),
          });
        }),
      };
    }),
  );
}
