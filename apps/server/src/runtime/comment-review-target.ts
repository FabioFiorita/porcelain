import { Effect } from 'effect';
import type { ReviewPreviewResponse } from '@porcelain/contracts/comments';
import type { DraftCommentView } from '@porcelain/reviews/models';
import type { ListProjectPullRequestsUseCasePort } from '../ports/list-project-pull-requests-use-case-port.ts';
import type { ResolveProjectGitHubUseCasePort } from '../ports/resolve-project-github-use-case-port.ts';

type Unavailable = Extract<ReviewPreviewResponse, { kind: 'unavailable' }>;

export const commentReviewTarget = Effect.fn('Comments.reviewTarget')(
  function* (
    capabilities: {
      readonly resolve: ResolveProjectGitHubUseCasePort;
      readonly pulls: ListProjectPullRequestsUseCasePort;
    },
    input: {
      readonly projectId: string;
      readonly branch: string;
      readonly comments: readonly DraftCommentView[];
    },
  ) {
    const open = input.comments.filter(
      (comment) => comment.publication.status === 'draft',
    );
    const unavailable = (reason: Unavailable['reason']) => ({
      open,
      found: { kind: 'unavailable' as const, reason },
    });
    if (open.length === 0) return unavailable('no-comments');
    const { repository, selection } = yield* capabilities.resolve.execute({
      projectId: input.projectId,
    });
    if (selection.unavailable) return unavailable(selection.unavailable.reason);
    if (!repository || !selection.choice) return unavailable('not-github');
    const listed = yield* capabilities.pulls.execute({
      projectId: input.projectId,
    });
    if (listed.kind !== 'available') return unavailable(listed.reason);
    const pull = listed.pullRequests.find(
      (candidate) =>
        candidate.state === 'open' && candidate.headBranch === input.branch,
    );
    if (!pull) return unavailable('no-pull-request');
    return {
      open,
      found: {
        kind: 'available' as const,
        pullRequest: { number: pull.number, url: pull.url, title: pull.title },
        target: {
          ...repository,
          account: selection.choice.account,
          number: pull.number,
        },
      },
    };
  },
);
