import { Atom, AsyncResult } from 'effect/reactivity';
import { Effect, Option } from 'effect';
import type { RuntimeConnection } from '../../../shared/api/connection.ts';
import { readGitStatus } from '../../changes/queries/changes.ts';
import {
  readProjectReviews,
  readReviewPullChecks,
  readReview,
} from '../../reviews/queries/project-reviews.ts';
import { readPublishedReview } from '../../reviews/queries/publication.ts';
import { refreshInventory } from './projects.ts';
import { readInventory } from '../queries/inventory.ts';
import {
  worktreeStatusNotices,
  worktreeNavigatorState,
} from '../store/worktree-navigator.ts';
import {
  navigatorProjectVisible,
  type NavigatorStatusNotice,
} from '../rules/worktree-navigator.ts';

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
        const state = get(worktreeNavigatorState);
        const sources = connections.flatMap((connection) => {
          const inventory = Option.getOrUndefined(
            AsyncResult.value(get(readInventory(connection))),
          );
          return (inventory?.projects ?? []).map((project) => ({
            connection,
            project,
            key: `${connection.environmentId}/${project.id}`,
          }));
        });
        for (const source of sources) {
          if (
            !navigatorProjectVisible(
              source.key,
              source.connection.environmentId,
              state.filter,
            )
          )
            continue;
          const projectRead = readProjectReviews({
            connection: source.connection,
            projectId: source.project.id,
          });
          if (
            !state.query.trim() &&
            state.expanded[source.key] === false &&
            !get.registry.getNodes().has(projectRead)
          )
            continue;
          const records = Option.getOrUndefined(
            AsyncResult.value(get(projectRead)),
          );
          get.refresh(projectRead);
          for (const record of records ?? []) {
            if (record.pullRequest)
              get.refresh(
                readReviewPullChecks({
                  connection: source.connection,
                  reviewId: record.reviewId,
                }),
              );
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
          for (const worktree of source.project.worktrees) {
            if (source.project.available && worktree.available) {
              get.refresh(
                readPublishedReview({
                  connection: source.connection,
                  scope: {
                    projectId: source.project.id,
                    worktreeId: worktree.id,
                  },
                }),
              );
              get.refresh(
                readGitStatus({
                  connection: source.connection,
                  scope: {
                    projectId: source.project.id,
                    worktreeId: worktree.id,
                  },
                }),
              );
            }
          }
        }
      }),
    ),
);
