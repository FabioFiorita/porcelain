import { useAtomValue } from '@effect/atom-react';
import { readWalkthroughMergeReview } from '@porcelain/client/walkthroughs';
import {
  type WalkthroughContent,
  type WalkthroughRun,
} from '@porcelain/client/walkthroughs/rules';
import { mergeReadiness } from '@porcelain/client/projects/rules';
import {
  ArchivePullRequest,
  MergePullRequest,
} from '@/features/projects/index';
import type { DocumentProps } from '@/features/workspace/index';
import { Button } from '@/components/ui/button';
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
        <div className="flex flex-wrap items-center gap-x-1 gap-y-1.5">
          <MergePullRequest
            context={document.context}
            projectId={projectId}
            pull={pull}
            label={`Merge #${number}`}
            review={review}
            reason={
              mergeReadiness({
                status: found.status,
                baseBranch: pull.baseBranch,
                mergeMethods: pull.mergeMethods,
                review,
              }).waitsFor
            }
          />
          <Button
            variant="link"
            size="sm"
            onClick={() => found.openCheck(undefined)}
          >
            Open #{number}
          </Button>
        </div>
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
