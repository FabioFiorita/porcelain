import { useAtomValue } from '@effect/atom-react';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import {
  readProjectPullRequest,
  readProjectPullRequests,
} from '@porcelain/client/projects';
import {
  unansweredCallStep,
  type WalkthroughContent,
  type WalkthroughRun,
} from '@porcelain/client/walkthroughs/rules';
import {
  ArchivePullRequest,
  MergePullRequest,
} from '@/features/projects/index';
import type { DocumentProps } from '@/features/workspace/index';
import { useConversations } from '../queries/conversations';

export function WalkthroughMerge({
  document,
  run,
  content,
}: {
  document: DocumentProps;
  run: WalkthroughRun;
  content: WalkthroughContent;
}) {
  const { connection } = document.context;
  const { projectId } = document.scope;
  const pulls = Option.getOrUndefined(
    AsyncResult.value(
      useAtomValue(readProjectPullRequests({ connection, projectId })),
    ),
  );
  const listed = pulls?.kind === 'available' ? pulls.pullRequests : [];
  const branch = listed.filter((pull) => pull.headBranch === run.branch);
  const pull =
    branch.find((entry) => entry.state === 'open') ??
    listed.find((entry) => entry.number === run.pullRequestNumber) ??
    branch[0];
  if (!pull) return null;
  return (
    <MergeRow
      document={document}
      run={run}
      content={content}
      number={pull.number}
    />
  );
}

function MergeRow({
  document,
  run,
  content,
  number,
}: {
  document: DocumentProps;
  run: WalkthroughRun;
  content: WalkthroughContent;
  number: number;
}) {
  const { connection } = document.context;
  const { projectId } = document.scope;
  const read = Option.getOrUndefined(
    AsyncResult.value(
      useAtomValue(readProjectPullRequest({ connection, projectId, number })),
    ),
  );
  const { view, failed } = useConversations({ ...document, run });
  if (read?.kind !== 'available') return null;
  const pull = read.pullRequest;
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
          review={{
            headOid: run.headOid,
            unansweredCallStep: unansweredCallStep(
              content,
              view?.conversations,
              failed,
            ),
          }}
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
