import { useAtomSet, useAtomValue } from '@effect/atom-react';
import { Option } from 'effect';
import { Atom, AsyncResult } from 'effect/reactivity';
import {
  readProjectPullRequest,
  readProjectPullRequests,
  readProjectPullStatus,
} from '@porcelain/client/projects';
import { withPullRequestStatus } from '@porcelain/client/projects/rules';
import type { WalkthroughRun } from '@porcelain/client/walkthroughs/rules';
import {
  pullRequestCheckFocus,
  pullRequestDocument,
  type DocumentProps,
} from '@/features/workspace/index';

const noPull = Atom.make(
  AsyncResult.initial<
    Atom.Success<ReturnType<typeof readProjectPullRequest>>
  >(),
);

const noStatus = Atom.make(
  AsyncResult.initial<Atom.Success<ReturnType<typeof readProjectPullStatus>>>(),
);

export function useWalkthroughPull(
  document: DocumentProps,
  run: Pick<WalkthroughRun, 'branch' | 'pullRequestNumber'>,
) {
  const { connection } = document.context;
  const { projectId } = document.scope;
  const focus = useAtomSet(pullRequestCheckFocus);
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
  const read = Option.getOrUndefined(
    AsyncResult.value(
      useAtomValue(
        pull
          ? readProjectPullRequest({
              connection,
              projectId,
              number: pull.number,
            })
          : noPull,
      ),
    ),
  );
  const statusRead = Option.getOrUndefined(
    AsyncResult.value(
      useAtomValue(
        pull
          ? readProjectPullStatus({
              connection,
              projectId,
              number: pull.number,
            })
          : noStatus,
      ),
    ),
  );
  if (!pull) return undefined;
  const status =
    statusRead?.kind === 'available' ? statusRead.status : undefined;
  return {
    number: pull.number,
    detail:
      read?.kind === 'available'
        ? withPullRequestStatus(read.pullRequest, status)
        : undefined,
    status,
    openCheck: (name: string | undefined) => {
      focus(
        name === undefined
          ? undefined
          : { projectId, number: pull.number, name },
      );
      document.onOpen(
        pullRequestDocument({
          projectId,
          number: pull.number,
          environmentId: connection.environmentId,
          shownOn: connection.environmentId,
        }),
      );
    },
  };
}

export type WalkthroughPull = ReturnType<typeof useWalkthroughPull>;
