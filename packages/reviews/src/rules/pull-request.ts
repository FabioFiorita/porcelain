import { DateTime, Option } from 'effect';
import type {
  GitHubPullRequest,
  GitHubPullSummary,
  PullRequest,
  PullRequestSummary,
} from '../models/pull-request.ts';

export function mapPullRequestSummary(
  raw: GitHubPullSummary,
): PullRequestSummary {
  const rollup = raw.commits.nodes[0]?.commit.statusCheckRollup;
  const state =
    raw.state === 'OPEN'
      ? 'open'
      : raw.state === 'MERGED'
        ? 'merged'
        : 'closed';
  return {
    number: raw.number,
    title: raw.title,
    url: raw.url,
    state,
    draft: raw.isDraft,
    author: raw.author?.login ?? undefined,
    headBranch: raw.headRefName,
    updatedAt: raw.updatedAt,
    checksSummary: rollup?.state ?? undefined,
    checksTruncated: rollup?.contexts.pageInfo.hasNextPage ?? false,
  };
}
export function mapPullRequest(
  raw: GitHubPullRequest,
  reviewHead: string,
): PullRequest {
  const rollup = raw.commits.nodes[0]?.commit.statusCheckRollup;
  const checks = (rollup?.contexts.nodes ?? []).map((check) =>
    check.__typename === 'CheckRun'
      ? {
          name: check.name,
          status: check.status,
          conclusion: check.conclusion ?? undefined,
          detailsUrl: check.detailsUrl ?? undefined,
          durationMs:
            check.status === 'COMPLETED'
              ? checkDuration(
                  check.startedAt ?? undefined,
                  check.completedAt ?? undefined,
                )
              : undefined,
        }
      : {
          name: check.context,
          status: check.state === 'PENDING' ? 'PENDING' : 'COMPLETED',
          conclusion: check.state === 'PENDING' ? undefined : check.state,
          detailsUrl: check.targetUrl ?? undefined,
        },
  );
  const timeline: PullRequest['timeline'][number][] = raw.comments.nodes.map(
    (comment) => ({
      id: comment.id,
      kind: 'comment',
      author: comment.author?.login ?? undefined,
      time: comment.createdAt,
      body: comment.body,
      url: comment.url,
      reviewState: undefined,
      path: undefined,
      line: undefined,
      originalLine: undefined,
    }),
  );
  for (const review of raw.reviews.nodes) {
    if (typeof review.submittedAt === 'string')
      timeline.push({
        id: review.id,
        kind: 'review',
        author: review.author?.login ?? undefined,
        time: review.submittedAt,
        body: review.body,
        url: review.url,
        reviewState: review.state,
        path: undefined,
        line: undefined,
        originalLine: undefined,
      });
    for (const comment of review.comments.nodes)
      timeline.push({
        id: comment.id,
        kind: 'review-comment',
        author: comment.author?.login ?? undefined,
        time: comment.createdAt,
        body: comment.body,
        url: comment.url,
        reviewState: undefined,
        path: comment.path,
        line: comment.line ?? undefined,
        originalLine: comment.originalLine ?? undefined,
      });
  }
  timeline.sort(
    (a, b) => a.time.localeCompare(b.time) || a.id.localeCompare(b.id),
  );
  return {
    ...mapPullRequestSummary(raw),
    description: raw.body,
    baseBranch: raw.baseRefName,
    headSha: raw.headRefOid,
    matchesReviewHead: raw.headRefOid === reviewHead,
    mergeable: raw.mergeable,
    labels: raw.labels.nodes,
    checks,
    timeline,
    truncated:
      raw.labels.pageInfo.hasNextPage ||
      raw.comments.pageInfo.hasNextPage ||
      raw.reviews.pageInfo.hasNextPage ||
      raw.reviews.nodes.some(
        (review) => review.comments.pageInfo.hasNextPage,
      ) ||
      (rollup?.contexts.pageInfo.hasNextPage ?? false),
  };
}

export function recentPullRequestCutoff(now: number): string {
  return new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
}

function checkDuration(
  startedAt: string | undefined,
  completedAt: string | undefined,
): number | undefined {
  if (typeof startedAt !== 'string' || typeof completedAt !== 'string')
    return undefined;
  const started = Option.getOrUndefined(DateTime.make(startedAt));
  const completed = Option.getOrUndefined(DateTime.make(completedAt));
  if (started === undefined || completed === undefined) return undefined;
  const durationMs =
    DateTime.toEpochMillis(completed) - DateTime.toEpochMillis(started);
  return durationMs >= 0 ? durationMs : undefined;
}
