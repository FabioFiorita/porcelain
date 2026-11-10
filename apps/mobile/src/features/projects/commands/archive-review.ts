import { useAtom } from '@effect/atom-react';
import { Effect } from 'effect';
import { Atom } from 'effect/reactivity';
import { reviewCommands } from '@porcelain/client/reviews';
import { ProjectSelectionCommands } from '@porcelain/client/projects';
import type { ArchiveReviewRequest } from '@porcelain/contracts/reviews';
import type { RuntimeConnection } from '@porcelain/client/transport';
import { clientRuntime } from '../../../shared/application/store';
const command = Atom.family(
  (input: {
    connection: RuntimeConnection;
    reviewId: string;
    projectId: string;
    mainWorktreeId: string;
  }) =>
    clientRuntime.fn((payload: ArchiveReviewRequest, get) =>
      Effect.gen(function* () {
        if (payload.confirmation) {
          const selection = yield* ProjectSelectionCommands;
          yield* selection.execute({
            kind: 'workspace',
            environmentId: input.connection.environmentId,
            projectId: input.projectId,
            worktreeId: input.mainWorktreeId,
          });
        }
        return yield* get.setResult(reviewCommands(input).archive, payload);
      }),
    ),
);
export function useArchiveReview(input: {
  connection: RuntimeConnection;
  reviewId: string;
  projectId: string;
  mainWorktreeId: string;
}) {
  const [result, run] = useAtom(command(input), { mode: 'promise' });
  const submit = async (
    payload: ArchiveReviewRequest,
    onArchived?: () => void,
  ) => {
    let answer;
    try {
      answer = await run(payload);
    } catch {
      return undefined;
    }
    if (answer.archived && onArchived) onArchived();
    return answer;
  };
  return {
    result,
    submit,
    prepare: (
      options: ArchiveReviewRequest['options'],
      onStart: () => void,
    ) => {
      onStart();
      void submit({ options });
    },
  };
}
