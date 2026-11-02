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
import { readInventory } from '../queries/inventory.ts';
import { worktreeStatusNotices } from '../store/worktree-navigator.ts';
import type { NavigatorStatusNotice } from '../rules/worktree-navigator.ts';

function changeFailures(
  get: Atom.FnContext,
  environmentId: string,
  change: (
    failures: NavigatorStatusNotice['failures'],
  ) => NavigatorStatusNotice['failures'],
) {
  get.set(
    worktreeStatusNotices,
    get(worktreeStatusNotices).flatMap((notice) => {
      if (notice.environmentId !== environmentId) return [notice];
      const failures = change(notice.failures);
      return failures.length > 0 ? [{ ...notice, failures }] : [];
    }),
  );
}

export const refreshWorktreeNavigator = Atom.family(
  (connections: readonly RuntimeConnection[]) =>
    Atom.fn(
      Effect.fn('WorktreeNavigator.refresh')(function* (
        target: { environmentId: string } | void,
        get: Atom.FnContext,
      ) {
        if (target) {
          const connection = connections.find(
            (connection) => connection.environmentId === target.environmentId,
          );
          const issue = get(worktreeStatusNotices).find(
            (issue) => issue.environmentId === target.environmentId,
          );
          if (!connection || !issue) return;
          yield* get.setResult(refreshInventory(connection), undefined);
          const inventory = yield* get.result(readInventory(connection), {
            suspendOnWaiting: true,
          });
          const remaining = issue.failures.filter(({ entry }) =>
            inventory.projects.some(
              (project) =>
                project.id === entry.projectId &&
                project.available &&
                project.worktrees.some(
                  (worktree) =>
                    worktree.id === entry.worktreeId && worktree.available,
                ),
            ),
          );
          const retainedKeys = remaining.map(({ entry }) => entry.key);
          changeFailures(get, target.environmentId, (failures) =>
            failures.filter(({ entry }) => retainedKeys.includes(entry.key)),
          );
          yield* Effect.forEach(
            remaining,
            (failure) => {
              const entry = failure.entry;
              if (!entry.worktreeId) return Effect.void;
              const status = readGitStatus({
                connection,
                scope: {
                  projectId: entry.projectId,
                  worktreeId: entry.worktreeId,
                },
              });
              get.refresh(status);
              return get.result(status, { suspendOnWaiting: true }).pipe(
                Effect.match({
                  onSuccess: () =>
                    changeFailures(get, target.environmentId, (failures) =>
                      failures.filter(
                        (failure) => failure.entry.key !== entry.key,
                      ),
                    ),
                  onFailure: (error) =>
                    changeFailures(get, target.environmentId, (failures) =>
                      failures.map((failure) =>
                        failure.entry.key === entry.key
                          ? { ...failure, detail: error.message }
                          : failure,
                      ),
                    ),
                }),
              );
            },
            { concurrency: 'unbounded' },
          );
          return;
        }
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
