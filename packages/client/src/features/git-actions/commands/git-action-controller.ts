import { OperationStore } from '../ports/operation-store.ts';
import type { GitConnection } from '../ports/git-connection.ts';
import { Context, Crypto, Effect, Layer, Schema, Semaphore } from 'effect';
import { Atom, AtomRegistry } from 'effect/reactivity';
import type {
  RunGitActionRequest,
  RunGitActionResponse,
} from '@porcelain/contracts/git-actions';
import type { WorktreeScope } from '../../../shared/api/connection.ts';
import { porcelainClient } from '../../../shared/api/client.ts';
import { currentAnswerEffect } from '../../../shared/api/stale-answer.ts';
import { RequestError } from '../../../shared/api/request-error.ts';
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
  ) {
    yield* currentAnswerEffect(
      connection,
      receipt.requestId ===
        operations.state.value.operations.get(key)?.requestId,
    );
    yield* refresh.refresh(receipt);
    yield* currentAnswerEffect(
      connection,
      receipt.requestId ===
        operations.state.value.operations.get(key)?.requestId,
    );
    yield* operations.accept(receipt);
  });
  const send = Effect.fn('GitActionController.send')(function* (
    request: RunGitActionRequest,
  ) {
    const result = yield* client.request((api) =>
      api.gitActions.runGitAction({
        params: { worktreeId: scope.worktreeId },
        payload: request,
      }),
    );
    if (!('requestId' in result))
      return yield* Effect.fail(
        new RequestError({
          status: result.statusCode,
          message: result.message,
        }),
      );
    yield* currentAnswerEffect(
      connection,
      result.projectId === scope.projectId &&
        result.worktreeId === scope.worktreeId &&
        result.requestId === request.requestId &&
        result.action === action,
    );
    yield* accept(result);
    return yield* operations.wait(key, request.requestId);
  });
  return {
    execute: Effect.fn('GitActionController.execute')(function* (
      input: Pick<RunGitActionRequest, 'input' | 'expected'>,
    ) {
      return yield* connection.request(
        Effect.gen(function* () {
          const request = yield* admission.withPermit(
            Effect.gen(function* () {
              yield* currentAnswerEffect(connection);
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
          return yield* send(request);
        }),
      );
    }),
    recover: Effect.fn('GitActionController.recover')(function* () {
      return yield* connection.request(
        Effect.gen(function* () {
          yield* currentAnswerEffect(connection);
          const current = operations.state.value.operations.get(key);
          if (!current)
            return yield* Effect.fail(
              new GitOperationStateError({ reason: 'missing' }),
            );
          return yield* send(current.request);
        }),
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

export function gitActionCommands(
  selection: Selection,
  registry: AtomRegistry.AtomRegistry,
) {
  const execute = runGitAction(selection);
  const recovery = recoverGitAction(selection);
  const start = startNewGitAction(selection);
  const reset = () => {
    registry.set(execute, Atom.Reset);
    registry.set(recovery, Atom.Reset);
  };
  return {
    run: Effect.fn('GitActions.run')(function* (
      input: RunGitActionRequest['input'],
      expected: RunGitActionRequest['expected'],
    ) {
      registry.set(execute, { input, expected });
      return yield* AtomRegistry.getResult(registry, execute, {
        suspendOnWaiting: true,
      });
    }),
    recover: Effect.fn('GitActions.recover')(function* () {
      registry.set(recovery, undefined);
      return yield* AtomRegistry.getResult(registry, recovery, {
        suspendOnWaiting: true,
      });
    }),
    startNew: Effect.fn('GitActions.startNew')(function* () {
      registry.set(start, undefined);
      if (
        yield* AtomRegistry.getResult(registry, start, {
          suspendOnWaiting: true,
        })
      )
        reset();
    }),
    reset,
  };
}

export const readGitActionCommands = Atom.family((selection: Selection) =>
  Atom.make(
    Effect.gen(function* () {
      const registry = yield* AtomRegistry.AtomRegistry;
      return gitActionCommands(selection, registry);
    }),
  ),
);
