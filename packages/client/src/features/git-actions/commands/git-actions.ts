import { Effect, type Scope } from 'effect';
import { Atom, AtomRegistry, Reactivity } from 'effect/reactivity';
import type { GenerateCommitDraftRequest } from '@porcelain/contracts/git-actions';
import type {
  RuntimeConnection,
  WorktreeScope,
} from '../../../shared/api/connection.ts';
import { porcelainClient } from '../../../shared/api/client.ts';
import { clientRuntime } from '../../../shared/api/runtime.ts';
import { currentAnswerEffect } from '../../../shared/api/stale-answer.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';

type Selection = {
  readonly connection: RuntimeConnection;
  readonly scope: WorktreeScope;
};
export const generateCommitDraft = Atom.family(
  ({ connection, scope }: Selection) =>
    clientRuntime(connection).fn(
      Effect.fn('GitActions.generateCommitDraft')(function* ({
        lifetime,
        ...input
      }: GenerateCommitDraftRequest & { lifetime?: Scope.Scope }) {
        const client = yield* porcelainClient(connection);
        const result = yield* client.request(
          (api) =>
            api.gitActions.generateCommitDraft({
              params: { worktreeId: scope.worktreeId },
              payload: input,
            }),
          lifetime,
        );
        yield* currentAnswerEffect(connection);
        return result;
      }),
      { concurrent: true },
    ),
);
export const dismissInterruptedGitAction = Atom.family(
  ({ connection, scope }: Selection) =>
    clientRuntime(connection).fn(
      Effect.fn('GitActions.dismissInterrupted')(function* (requestId: string) {
        const client = yield* porcelainClient(connection);
        yield* client.request((api) =>
          api.gitActions.dismissInterruptedGitAction({
            params: { worktreeId: scope.worktreeId, requestId },
          }),
        );
        yield* currentAnswerEffect(connection);
        yield* Reactivity.invalidate([
          queryKeys.reviewSurface(connection.environmentId, scope, ['changes']),
        ]);
      }),
    ),
);

export const readCommitDraftCommand = Atom.family((selection: Selection) =>
  Atom.make(
    Effect.gen(function* () {
      const registry = yield* AtomRegistry.AtomRegistry;
      const command = generateCommitDraft(selection);
      return Effect.fn('CommitDraft.submit')(function* (
        input: GenerateCommitDraftRequest,
        lifetime: Scope.Scope,
      ) {
        registry.set(command, { ...input, lifetime });
        return yield* AtomRegistry.getResult(registry, command, {
          suspendOnWaiting: true,
        });
      });
    }),
  ),
);
