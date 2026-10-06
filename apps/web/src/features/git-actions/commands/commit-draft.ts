import { useAtom } from '@effect/atom-react';
import { Cause, Exit } from 'effect';
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
      return generate({ ...input, signal: controller.signal })
        .then((completed) => {
          if (Exit.isFailure(completed)) throw Cause.squash(completed.cause);
          return completed.value;
        })
        .finally(() => drafts.delete(controller));
    },
  };
}
