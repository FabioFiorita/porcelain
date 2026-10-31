import { Atom, AsyncResult } from 'effect/reactivity';
import { Effect, Option } from 'effect';
import type { RuntimeConnection } from '../../../shared/api/connection.ts';
import {
  readGitStatus,
  readWorktreeSummary,
} from '../../changes/queries/changes.ts';
import {
  readProjectReviews,
  readReviewPullChecks,
  readReview,
  readReviewMarks,
} from '../../reviews/queries/project-reviews.ts';
import { readWorktreeNavigator } from '../queries/worktree-navigator.ts';
import { refreshInventory } from './projects.ts';

export const refreshWorktreeNavigator = Atom.family(
  (connections: readonly RuntimeConnection[]) =>
    Atom.fn(
      Effect.fn('WorktreeNavigator.refresh')(function* (
        _: void,
        get: Atom.FnContext,
      ) {
        yield* Effect.forEach(
          connections,
          (connection) =>
            get.setResult(refreshInventory(connection), undefined),
          { concurrency: 'unbounded' },
        );
        const view = get(readWorktreeNavigator(connections));
        for (const source of view.projects) {
          if (!source.expanded) continue;
          const projectRead = readProjectReviews({
            connection: source.connection,
            projectId: source.project.id,
          });
          const records = Option.getOrUndefined(
            AsyncResult.value(get(projectRead)),
          );
          get.refresh(projectRead);
          for (const record of records ?? []) {
            if (record.state !== 'open' || record.archived) continue;
            if (
              !source.project.worktrees.some(
                (worktree) =>
                  (worktree.branch ?? 'Detached HEAD') === record.branch,
              )
            )
              continue;
            get.refresh(
              readReview({
                connection: source.connection,
                reviewId: record.reviewId,
              }),
            );
          }
          for (const entry of source.entries) {
            if (entry.worktreeId && entry.available) {
              if (
                entry.changes.state === 'available' &&
                entry.changes.count > 0
              )
                get.refresh(
                  readWorktreeSummary({
                    connection: source.connection,
                    scope: {
                      projectId: entry.projectId,
                      worktreeId: entry.worktreeId,
                    },
                  }),
                );
              get.refresh(
                readGitStatus({
                  connection: source.connection,
                  scope: {
                    projectId: entry.projectId,
                    worktreeId: entry.worktreeId,
                  },
                }),
              );
            }
            if (
              entry.review.state === 'available' &&
              entry.review.pullRequestNumber
            )
              get.refresh(
                readReviewPullChecks({
                  connection: source.connection,
                  reviewId: entry.review.reviewId,
                }),
              );
            if (
              entry.kind === 'worktree' &&
              entry.review.state === 'available' &&
              !entry.review.closed
            ) {
              const input = {
                connection: source.connection,
                reviewId: entry.review.reviewId,
              };
              get.refresh(readReviewMarks(input));
            }
          }
        }
      }),
    ),
);
