import { requestDocumentLeave } from '../store';
import { useAtom } from '@effect/atom-react';
import { Effect } from 'effect';
import { Atom } from 'effect/reactivity';
import { reviewCommands } from '@porcelain/client/reviews';
import { ProjectSelectionCommands } from '@porcelain/client/projects';
import type { ArchiveReviewRequest } from '@porcelain/contracts/reviews';
import type { RuntimeConnection } from '@porcelain/client/transport';
import { clientRuntime } from '../../../shared/application/store';
import { showAlertDialog } from '../../../components/ui/alert-dialog';
import { archiveDescription } from '@porcelain/client/reviews/rules';
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
  const submit = async (payload: ArchiveReviewRequest) => {
    try {
      return await run(payload);
    } catch {
      return undefined;
    }
  };
  async function prepare(options: ArchiveReviewRequest['options']) {
    const answer = await submit({ options });
    if (!answer) return;
    const { plan } = answer;
    showAlertDialog({
      title: 'Archive review?',
      description: archiveDescription(plan),
      action:
        plan.dirty || plan.unpushed
          ? 'Archive and accept data loss'
          : 'Archive review',
      onConfirm: () => {
        void submit({
          options,
          confirmation: { plan, discardChanges: true },
        });
      },
    });
  }
  return {
    result,
    prepare: (options: ArchiveReviewRequest['options']) =>
      requestDocumentLeave(() => {
        void prepare(options);
      }),
  };
}
