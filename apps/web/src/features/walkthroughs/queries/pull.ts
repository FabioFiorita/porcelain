import { useAtomSet, useAtomValue } from '@effect/atom-react';
import { Option } from 'effect';
import { Atom, AsyncResult } from 'effect/reactivity';
import {
  readProjectPullRequest,
  readProjectPullRequests,
} from '@porcelain/client/projects';
import type { WalkthroughRun } from '@porcelain/client/walkthroughs/rules';
import {
  pullRequestCheckFocus,
  type DocumentProps,
} from '@/features/workspace/index';

const noPull = Atom.make(
  AsyncResult.initial<
    Atom.Success<ReturnType<typeof readProjectPullRequest>>
  >(),
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
  if (!pull) return undefined;
  return {
    number: pull.number,
    detail: read?.kind === 'available' ? read.pullRequest : undefined,
    openCheck: (name: string | undefined) => {
      focus(
        name === undefined
          ? undefined
          : { projectId, number: pull.number, name },
      );
      document.onOpen({
        kind: 'pull-request',
        projectId,
        number: pull.number,
        environmentId: connection.environmentId,
      });
    },
  };
}

export type WalkthroughPull = ReturnType<typeof useWalkthroughPull>;
