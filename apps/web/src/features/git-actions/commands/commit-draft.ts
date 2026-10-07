import { useAtom } from '@effect/atom-react';
import { Cause, Effect, Exit, Scope } from 'effect';
import { generateCommitDraft } from '@porcelain/client/git-actions';
import type {
  CommitDraftInput,
  GitScope,
} from '@porcelain/client/git-actions/rules';
import { type ConnectionContext } from '@/shared/workspace/connection';

export function useCommitDraft(
  scope: GitScope,
  context: ConnectionContext,
  drafts: Set<AbortController>,
) {
  const [result, generate] = useAtom(
    generateCommitDraft({ connection: context.connection, scope }),
    { mode: 'promiseExit' },
  );
  return {
    result,
    submit: (input: CommitDraftInput) => {
      const controller = new AbortController();
      drafts.add(controller);
      const lifetime = Scope.makeUnsafe();
      const interrupt = () => {
        void Effect.runPromise(Scope.close(lifetime, Exit.void));
      };
      controller.signal.addEventListener('abort', interrupt, { once: true });
      return generate({ ...input, lifetime })
        .then((completed) => {
          if (Exit.isFailure(completed)) throw Cause.squash(completed.cause);
          return completed.value;
        })
        .finally(() => {
          interrupt();
          controller.signal.removeEventListener('abort', interrupt);
          drafts.delete(controller);
        });
    },
  };
}
