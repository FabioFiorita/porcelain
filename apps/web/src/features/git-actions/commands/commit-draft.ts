import type { Atom } from 'effect/reactivity';
import { useConfirmedRead } from '@/shared/query/confirmed-read';
import { useAtomValue } from '@effect/atom-react';
import { Effect, Exit, Scope } from 'effect';
import {
  generateCommitDraft,
  readCommitDraftCommand,
} from '@porcelain/client/git-actions';
import type {
  CommitDraftInput,
  GitScope,
} from '@porcelain/client/git-actions/rules';
import { type ConnectionContext } from '@/shared/workspace/connection';

const submitDraft = Effect.fn('BrowserCommitDraft.submit')(function* (
  submit: Atom.Success<ReturnType<typeof readCommitDraftCommand>>,
  drafts: Set<AbortController>,
  input: CommitDraftInput,
) {
  return yield* Effect.scoped(
    Effect.gen(function* () {
      const lifetime = yield* Effect.acquireRelease(Scope.make(), (scope) =>
        Scope.close(scope, Exit.void),
      );
      const controller = new AbortController();
      const interrupt = () => {
        Effect.runFork(Scope.close(lifetime, Exit.void));
      };
      yield* Effect.acquireRelease(
        Effect.sync(() => {
          drafts.add(controller);
          controller.signal.addEventListener('abort', interrupt, {
            once: true,
          });
        }),
        () =>
          Effect.sync(() => {
            controller.signal.removeEventListener('abort', interrupt);
            drafts.delete(controller);
          }),
      );
      return yield* submit(input, lifetime);
    }),
  );
});

export function useCommitDraft(
  scope: GitScope,
  context: ConnectionContext,
  drafts: Set<AbortController>,
) {
  const { value: submit } = useConfirmedRead(
    readCommitDraftCommand({ connection: context.connection, scope }),
  );
  const command = generateCommitDraft({
    connection: context.connection,
    scope,
  });
  const result = useAtomValue(command);
  return {
    result,
    submit: (input: CommitDraftInput) => submitDraft(submit, drafts, input),
  };
}
