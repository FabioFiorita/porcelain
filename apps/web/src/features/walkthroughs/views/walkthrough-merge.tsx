import { useAtomValue } from '@effect/atom-react';
import { readWalkthroughMergeReview } from '@porcelain/client/walkthroughs';
import {
  type WalkthroughContent,
  type WalkthroughRun,
} from '@porcelain/client/walkthroughs/rules';
import {
  ArchivePullRequest,
  MergePullRequest,
} from '@/features/projects/index';
import type { DocumentProps } from '@/features/workspace/index';
import { useWalkthroughPull } from '../queries/pull';

export function WalkthroughMerge({
  document,
  run,
  content,
}: {
  document: DocumentProps;
  run: WalkthroughRun;
  content: WalkthroughContent;
}) {
  const { projectId } = document.scope;
  const found = useWalkthroughPull(document, run);
  const review = useAtomValue(
    readWalkthroughMergeReview({
      connection: document.context.connection,
      scope: document.scope,
      runId: run.id,
      headOid: run.headOid,
      content,
    }),
  );
  const pull = found?.detail;
  if (!found || !pull) return null;
  const number = found.number;
  return (
    <section
      aria-label={`Pull request #${number}`}
      className="flex flex-col gap-2 border-t pt-5"
    >
      {pull.state === 'open' ? (
        <MergePullRequest
          context={document.context}
          projectId={projectId}
          pull={pull}
          label={`Merge #${number}`}
          review={review}
        />
      ) : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <p className="text-ui text-muted-foreground">
            #{number} is {pull.state}.
          </p>
          <ArchivePullRequest
            context={document.context}
            projectId={projectId}
            number={number}
          />
        </div>
      )}
    </section>
  );
}
