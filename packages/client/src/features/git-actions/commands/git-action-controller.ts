import { OperationStore } from '../ports/operation-store.ts';
import type { GitConnection } from '../ports/git-connection.ts';
import { Context, Crypto, Effect, Layer, Schema, Semaphore } from 'effect';
import { Atom } from 'effect/reactivity';
import type {
  RunGitActionRequest,
  RunGitActionResponse,
} from '@porcelain/contracts/git-actions';
import type { WorktreeScope } from '../../../shared/api/connection.ts';
import { porcelainClient } from '../../../shared/api/client.ts';
import { currentAnswerEffect } from '../../../shared/api/stale-answer.ts';
import { RequestError } from '../../../shared/api/request-error.ts';
import { withSignal } from '@porcelain/effects';
import { isTerminal, operationKey } from '../store/operations.ts';
import { ConnectionError } from '../../../shared/api/connection-error.ts';
import { GitReceiptRefresh, receiptRuntime } from './refresh-receipt.ts';

type Selection = {
  readonly connection: GitConnection;
  readonly scope: WorktreeScope;
  readonly action: RunGitActionRequest['input']['action'];
};
class GitOperationStateError extends Schema.TaggedError<GitOperationStateError>()(
  'GitOperationStateError',
  { reason: Schema.Literals(['pending', 'missing', 'mismatch']) },
) {
  override get message() {
    switch (this.reason) {
      case 'pending':
        return 'Check the existing receipt before starting another operation.';
      case 'missing':
        return 'No operation to recover';
      case 'mismatch':
        return 'Action mismatch';
    }
  }
}

const makeController = Effect.fn('GitActionController.make')(function* ({
  connection,
  scope,
  action,
}: Selection) {
  const client = yield* porcelainClient(connection);
  const operations = yield* OperationStore;
  const crypto = yield* Crypto.Crypto;
  const refresh = yield* GitReceiptRefresh;
  const admission = yield* Semaphore.make(1);
  const key = operationKey(scope, action);
  const accept = Effect.fn('GitActionController.accept')(function* (
    receipt: RunGitActionResponse,
    signal: AbortSignal,
  ) {
    yield* currentAnswerEffect(
      signal,
      receipt.requestId ===
        operations.state.value.operations.get(key)?.requestId,
    );
    yield* refresh.refresh(receipt);
    yield* currentAnswerEffect(
      signal,
      receipt.requestId ===
        operations.state.value.operations.get(key)?.requestId,
    );
    yield* operations.accept(receipt);
  });
  const send = Effect.fn('GitActionController.send')(function* (
    request: RunGitActionRequest,
    signal: AbortSignal,
  ) {
    const result = yield* client.request(
      (api) =>
        api.gitActions.runGitAction({
          params: { worktreeId: scope.worktreeId },
          payload: request,
        }),
      signal,
    );
    if (!('requestId' in result))
      return yield* Effect.fail(
        new RequestError({
          status: result.statusCode,
          message: result.message,
        }),
      );
    yield* currentAnswerEffect(
      signal,
      result.projectId === scope.projectId &&
        result.worktreeId === scope.worktreeId &&
        result.requestId === request.requestId &&
        result.action === action,
    );
    yield* accept(result, signal);
    return yield* operations.wait(key, request.requestId);
  });
  return {
    execute: Effect.fn('GitActionController.execute')(function* (
      input: Pick<RunGitActionRequest, 'input' | 'expected'>,
    ) {
      const signal = connection.request().signal;
      return yield* withSignal(
        Effect.gen(function* () {
          const request = yield* admission.withPermit(
            Effect.gen(function* () {
              yield* currentAnswerEffect(signal);
              const previous = operations.state.value.operations.get(key);
              if (
                previous &&
                (!previous.receipt || !isTerminal(previous.receipt))
              )
                return yield* Effect.fail(
                  new GitOperationStateError({ reason: 'pending' }),
                );
              if (input.input.action !== action)
                return yield* Effect.fail(
                  new GitOperationStateError({ reason: 'mismatch' }),
                );
              const request = {
                ...input,
                requestId: yield* crypto.randomUUIDv4.pipe(
                  Effect.mapError(
                    (cause) =>
                      new ConnectionError({
                        message: 'Could not create a Git recovery identity.',
                        cause,
                      }),
                  ),
                ),
              };
              yield* operations.set(key, {
                ...scope,
                requestId: request.requestId,
                request,
              });
              return request;
            }),
          );
          return yield* send(request, signal);
        }),
        signal,
      );
    }),
    recover: Effect.fn('GitActionController.recover')(function* () {
      const signal = connection.request().signal;
      return yield* withSignal(
        Effect.gen(function* () {
          yield* currentAnswerEffect(signal);
          const current = operations.state.value.operations.get(key);
          if (!current)
            return yield* Effect.fail(
              new GitOperationStateError({ reason: 'missing' }),
            );
          return yield* send(current.request, signal);
        }),
        signal,
      );
    }),
    startNew: Effect.fn('GitActionController.startNew')(function* () {
      return yield* admission.withPermit(
        Effect.gen(function* () {
          const receipt = operations.state.value.operations.get(key)?.receipt;
          if (!receipt || !isTerminal(receipt)) return false;
          yield* operations.set(key, null);
          return true;
        }),
      );
    }),
  };
});

class GitActionController extends Context.Service<
  GitActionController,
  Effect.Success<ReturnType<typeof makeController>>
>()('@porcelain/client/GitActionController') {
  static layer(selection: Selection) {
    return Layer.effect(GitActionController, makeController(selection));
  }
}
const controllerRuntime = Atom.family((selection: Selection) =>
  selection.connection.atoms((get) =>
    Layer.provideMerge(
      GitActionController.layer(selection),
      Layer.mergeAll(
        get(receiptRuntime(selection.connection).layer),
        Layer.effectContext(selection.connection.runtime.contextEffect),
      ),
    ),
  ),
);
export const runGitAction = Atom.family((selection: Selection) =>
  controllerRuntime(selection).fn(
    (input: Pick<RunGitActionRequest, 'input' | 'expected'>) =>
      GitActionController.use((controller) => controller.execute(input)),
    { concurrent: true },
  ),
);
export const recoverGitAction = Atom.family((selection: Selection) =>
  controllerRuntime(selection).fn(
    (_: void) => GitActionController.use((controller) => controller.recover()),
    { concurrent: true },
  ),
);
export const startNewGitAction = Atom.family((selection: Selection) =>
  controllerRuntime(selection).fn((_: void) =>
    GitActionController.use((controller) => controller.startNew()),
  ),
);
