import { Atom, AsyncResult } from 'effect/reactivity';
import { Effect, Option } from 'effect';
import type { RuntimeConnection } from '../../../shared/api/connection.ts';
import { readGitStatus } from '../../changes/queries/changes.ts';
import {
  readProjectPullRequests,
  readProjectPullChecks,
} from '../queries/pull-requests.ts';
import { refreshInventory } from './projects.ts';
import { readInventory } from '../queries/inventory.ts';
import { worktreeNavigatorState } from '../store/worktree-navigator.ts';
import { navigatorProjectVisible } from '../rules/worktree-navigator.ts';

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
          if (!connection) return;
          const statusOf = (projectId: string, worktreeId: string) =>
            readGitStatus({ connection, scope: { projectId, worktreeId } });
          const failed = (
            Option.getOrUndefined(
              AsyncResult.value(get(readInventory(connection))),
            )?.projects ?? []
          ).flatMap((project) =>
            project.worktrees
              .filter((worktree) => {
                const status = statusOf(project.id, worktree.id);
                return (
                  get.registry.getNodes().has(status) &&
                  AsyncResult.isFailure(get.registry.get(status))
                );
              })
              .map((worktree) => ({
                projectId: project.id,
                worktreeId: worktree.id,
              })),
          );
          if (failed.length === 0) return;
          yield* get.setResult(refreshInventory(connection), undefined);
          const inventory = yield* get.result(readInventory(connection), {
            suspendOnWaiting: true,
          });
          const remaining = failed.filter(({ projectId, worktreeId }) =>
            inventory.projects.some(
              (project) =>
                project.id === projectId &&
                project.available &&
                project.worktrees.some(
                  (worktree) =>
                    worktree.id === worktreeId && worktree.available,
                ),
            ),
          );
          yield* Effect.forEach(
            remaining,
            ({ projectId, worktreeId }) => {
              const status = statusOf(projectId, worktreeId);
              get.refresh(status);
              return get
                .result(status, { suspendOnWaiting: true })
                .pipe(Effect.ignore);
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
          const projectRead = readProjectPullRequests({
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
          for (const pull of records?.kind === 'available'
            ? records.pullRequests
            : []) {
            get.refresh(
              readProjectPullChecks({
                connection: source.connection,
                projectId: source.project.id,
                number: pull.number,
              }),
            );
          }
          for (const worktree of source.project.worktrees) {
            if (source.project.available && worktree.available) {
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
