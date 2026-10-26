import { Option } from 'effect';
import { AsyncResult, Atom } from 'effect/reactivity';
import type { RuntimeConnection } from '../../../shared/api/connection.ts';
import { readInventory } from '../../projects/queries/inventory.ts';
import type { Project } from '../../projects/rules/inventory.ts';
import { worktreeLabel } from '../../projects/rules/inventory.ts';
import {
  checkoutFolder,
  reviewArchivable,
  reviewClosed,
  reviewListStatus,
  reviewListTitle,
  reviewPullRequestNotice,
  type ReviewListEntry,
} from '../rules/review-list.ts';
import {
  readProjectReviews,
  readReview,
  readReviewMarks,
  readReviewPullRequest,
} from './project-reviews.ts';

export const readReviewList = Atom.family(
  (connections: readonly RuntimeConnection[]) =>
    Atom.readable((get) => {
      const entries: ReviewListEntry[] = [];
      const messages: string[] = [];
      const projects: {
        connection: RuntimeConnection;
        project: Project;
        environmentName: string;
      }[] = [];
      let loading = false;
      function value<A, E>(
        result: AsyncResult.AsyncResult<A, E>,
        label: string,
      ) {
        if (AsyncResult.isInitial(result)) loading = true;
        if (AsyncResult.isFailure(result))
          messages.push(`${label} could not be read.`);
        return Option.getOrUndefined(AsyncResult.value(result));
      }
      for (const connection of connections) {
        const inventory = value(get(readInventory(connection)), 'Projects');
        if (!inventory) continue;
        for (const project of inventory.projects) {
          projects.push({
            connection,
            project,
            environmentName: inventory.environment.name,
          });
          const records = value(
            get(readProjectReviews({ connection, projectId: project.id })),
            `Reviews for ${project.name}`,
          );
          const reviewedWorktrees = new Set<string>();
          for (const record of records ?? []) {
            const input = { connection, reviewId: record.reviewId };
            const reviewResult = get(readReview(input));
            const markResult = get(readReviewMarks(input));
            const revision = value(
              reviewResult,
              `Review on ${record.branch}`,
            )?.revision;
            const marks = value(markResult, `Progress on ${record.branch}`);
            const pullResult = record.pullRequest
              ? get(readReviewPullRequest(input))
              : undefined;
            const pull = pullResult
              ? AsyncResult.isFailure(pullResult)
                ? { kind: 'failed' as const }
                : (value(pullResult, `Pull request on ${record.branch}`) ?? {
                    kind: 'loading' as const,
                  })
              : undefined;
            if (pullResult?.waiting) loading = true;
            const pullNotice = reviewPullRequestNotice(pull);
            const pullRequestIssue =
              pull?.kind === 'loading' ? undefined : pullNotice;
            if (pullRequestIssue)
              messages.push(`${record.branch}: ${pullRequestIssue}`);
            const worktree = project.worktrees.find(
              (row) =>
                worktreeLabel(row.branch) === record.branch &&
                (!revision || row.path === revision.worktreePath),
            );
            const closed = reviewClosed(record, pull);
            if (worktree && !closed) reviewedWorktrees.add(worktree.id);
            if (!closed && worktree?.main && !pullNotice) continue;
            if (
              AsyncResult.isInitial(reviewResult) ||
              AsyncResult.isInitial(markResult)
            )
              continue;
            entries.push({
              key: `${connection.environmentId}/${record.reviewId}`,
              environmentId: connection.environmentId,
              environmentName: inventory.environment.name,
              projectId: project.id,
              projectName: project.name,
              worktreeId: worktree?.id,
              path: worktree?.path ?? revision?.worktreePath,
              reviewId: record.reviewId,
              branch: record.branch,
              detached: worktree !== undefined && !worktree.branch,
              title: reviewListTitle(
                record,
                revision,
                pull?.kind === 'available' ? pull.pullRequest.title : undefined,
              ),
              closed,
              pullRequestIssue,
              archived: record.archived === true,
              archivable: reviewArchivable(record, pull),
              publishedAt: revision?.publishedAt,
              pullRequestNumber: record.pullRequest
                ?.split('/')
                .filter(Boolean)
                .at(-1),
              disabled: !project.available || worktree?.available === false,
              ...reviewListStatus({
                revision,
                marks,
                status: worktree?.status,
                pull,
              }),
              ...(closed ? { group: 'Closed' as const } : {}),
              ...(record.archived ||
              (pull?.kind === 'available' && pull.pullRequest.state !== 'open')
                ? {
                    badges: [
                      {
                        label: record.archived
                          ? 'Archived'
                          : pull?.kind === 'available'
                            ? `PR ${pull.pullRequest.state}`
                            : 'Closed',
                        variant: 'secondary' as const,
                      },
                    ],
                  }
                : {}),
            });
          }
          for (const worktree of project.worktrees) {
            if (!worktree.main && reviewedWorktrees.has(worktree.id)) continue;
            entries.push({
              key: `${connection.environmentId}/${project.id}/${worktree.id}`,
              environmentId: connection.environmentId,
              environmentName: inventory.environment.name,
              projectId: project.id,
              projectName: project.name,
              worktreeId: worktree.id,
              path: worktree.path,
              branch: worktreeLabel(worktree.branch),
              detached: !worktree.branch,
              title: worktree.main
                ? project.name
                : worktree.branch
                  ? worktreeLabel(worktree.branch)
                  : checkoutFolder(worktree.path).name,
              group: worktree.main ? 'Projects' : 'No review',
              closed: false,
              reviewed: 0,
              total: 0,
              badges: [],
              disabled: !project.available || !worktree.available,
            });
          }
        }
      }
      entries.sort(
        (a, b) =>
          (b.publishedAt ?? '').localeCompare(a.publishedAt ?? '') ||
          a.title.localeCompare(b.title) ||
          a.key.localeCompare(b.key),
      );
      return { entries, loading, messages, projects };
    }),
);
