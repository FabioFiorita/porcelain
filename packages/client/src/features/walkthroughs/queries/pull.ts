import { Option } from 'effect';
import { AsyncResult, Atom } from 'effect/reactivity';
import type { RuntimeConnection } from '../../../shared/api/connection.ts';
import {
  readProjectPullRequest,
  readProjectPullRequests,
  readProjectPullStatus,
} from '../../projects/queries/pull-requests.ts';
import { withPullRequestStatus } from '../../projects/rules/pull-request.ts';
import { walkthroughPullRequest } from '../rules/briefing.ts';

type PullSelection = {
  readonly connection: RuntimeConnection;
  readonly projectId: string;
  readonly branch: string | undefined;
  readonly pullRequestNumber: number | undefined;
};

export const readWalkthroughPull = Atom.family(
  ({ connection, projectId, branch, pullRequestNumber }: PullSelection) =>
    Atom.make((get) => {
      const pulls = Option.getOrUndefined(
        AsyncResult.value(
          get(readProjectPullRequests({ connection, projectId })),
        ),
      );
      const pull = walkthroughPullRequest(
        pulls?.kind === 'available' ? pulls.pullRequests : [],
        { branch, pullRequestNumber },
      );
      if (!pull) return undefined;
      const target = { connection, projectId, number: pull.number };
      const read = Option.getOrUndefined(
        AsyncResult.value(get(readProjectPullRequest(target))),
      );
      const statusResult = get(readProjectPullStatus(target));
      const statusRead = Option.getOrUndefined(AsyncResult.value(statusResult));
      const status =
        statusRead?.kind === 'available' ? statusRead.status : undefined;
      return {
        number: pull.number,
        detail:
          read?.kind === 'available'
            ? withPullRequestStatus(read.pullRequest, status)
            : undefined,
        status,
        statusUnread:
          (AsyncResult.isFailure(statusResult) && !statusResult.waiting) ||
          (statusRead !== undefined && statusRead.kind !== 'available'),
      };
    }),
);

export type WalkthroughPull = Atom.Type<ReturnType<typeof readWalkthroughPull>>;
