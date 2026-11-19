import { Option } from 'effect';
import { AsyncResult, Atom } from 'effect/reactivity';
import type { RuntimeConnection } from '../../../shared/api/connection.ts';
import { readGitStatus } from '../../changes/queries/changes.ts';
import {
  readProjectPullRequests,
  readProjectPullChecks,
} from './pull-requests.ts';
import {
  navigatorEntryMatches,
  navigatorProjectVisible,
  navigatorFilterSections,
  navigatorWorktreeOrder,
  navigatorDisplayTitle,
  type NavigatorEntry,
} from '../rules/worktree-navigator.ts';
import { worktreeLabel, type Project } from '../rules/inventory.ts';
import { worktreeNavigatorState } from '../store/worktree-navigator.ts';
import { readInventory } from './inventory.ts';
import {
  environmentIcon,
  type EnvironmentIcon,
} from '../../access/rules/environment-icon.ts';

type NavigatorProject = {
  key: string;
  connection: RuntimeConnection;
  project: Project;
  environmentName: string;
  environmentIcon: EnvironmentIcon;
  expanded: boolean;
  entries: readonly NavigatorEntry[];
};
type ProjectInput = {
  connection: RuntimeConnection;
  project: Project;
  environmentName: string;
};
function inventoryEntries(input: ProjectInput): NavigatorEntry[] {
  const { project, connection, environmentName } = input;
  return project.worktrees
    .map((worktree): NavigatorEntry => {
      const displayTitle = navigatorDisplayTitle(worktree);
      return {
        key: `${connection.environmentId}/${project.id}/${worktree.id}`,
        kind: 'worktree',
        environmentId: connection.environmentId,
        environmentName,
        projectId: project.id,
        projectName: project.name,
        worktreeId: worktree.id,
        path: worktree.path,
        name:
          worktree.branch ??
          worktree.path.split('/').filter(Boolean).at(-1) ??
          worktree.path,
        displayTitle,
        branch: worktreeLabel(worktree.branch),
        main: worktree.main,
        ...(worktree.headCommittedAt
          ? { headCommittedAt: worktree.headCommittedAt }
          : {}),
        ...(worktree.uncommittedChangedAt
          ? { uncommittedChangedAt: worktree.uncommittedChangedAt }
          : {}),
        detached: !worktree.branch,
        available: project.available && worktree.available,
        pullRequest: { state: 'loading' },
        changes: {
          state:
            project.available && worktree.available ? 'loading' : 'unavailable',
        },
      };
    })
    .sort(navigatorWorktreeOrder);
}
const readProjectEntries = Atom.family(
  (input: { connection: RuntimeConnection; projectId: string }) =>
    Atom.readable((get) => {
      const inventoryResult = get(readInventory(input.connection));
      const inventory = Option.getOrUndefined(
        AsyncResult.value(inventoryResult),
      );
      const savedProject = inventory?.projects.find(
        (project) => project.id === input.projectId,
      );
      if (!inventory || !savedProject) return [];
      const entries = inventoryEntries({
        ...input,
        project: savedProject,
        environmentName: inventory.environment.name,
      });
      const result = get(readProjectPullRequests(input));
      const answer = Option.getOrUndefined(AsyncResult.value(result));
      const previous = Option.getOrUndefined(
        get.self<readonly NavigatorEntry[]>(),
      );
      for (const entry of entries) {
        if (AsyncResult.isFailure(result) || answer?.kind === 'unavailable') {
          const known = previous?.find(
            (candidate) =>
              candidate.key === entry.key && candidate.branch === entry.branch,
          )?.pullRequest;
          entry.pullRequest =
            known?.state === 'available'
              ? {
                  state: 'available',
                  number: known.number,
                  merged: known.merged,
                }
              : { state: 'unavailable' };
        } else if (answer?.kind === 'available') {
          const pull = answer.pullRequests.find(
            (pull) => pull.headBranch === entry.branch,
          );
          entry.pullRequest = pull
            ? {
                state: 'available',
                number: pull.number,
                merged: pull.state === 'merged',
              }
            : { state: 'none' };
        }
      }
      return entries;
    }).pipe(Atom.setIdleTTL(0)),
);

const readNavigatorProject = Atom.family(
  (input: { connection: RuntimeConnection; projectId: string }) =>
    Atom.readable((get) => {
      const entries = get(readProjectEntries(input)).map((source) => {
        const entry: NavigatorEntry = { ...source };
        if (entry.available && entry.worktreeId) {
          const status = get(
            readGitStatus({
              connection: input.connection,
              scope: {
                projectId: entry.projectId,
                worktreeId: entry.worktreeId,
              },
            }),
          );
          const answer = Option.getOrUndefined(AsyncResult.value(status));
          entry.changes = answer
            ? {
                state: 'available',
                count: new Set(
                  answer.changes.map((change) =>
                    change.scope === 'untracked' || change.scope === 'unmerged'
                      ? change.path
                      : (change.newPath ?? change.oldPath),
                  ),
                ).size,
              }
            : AsyncResult.isFailure(status)
              ? { state: 'unavailable' }
              : { state: 'loading' };
        }
        return entry;
      });
      return entries;
    }).pipe(Atom.setIdleTTL(0)),
);
function connectionInventories(
  get: Atom.AtomContext,
  connections: readonly RuntimeConnection[],
) {
  const reads = connections.map((connection) => {
    const result = get(readInventory(connection));
    return {
      connection,
      result,
      inventory: Option.getOrUndefined(AsyncResult.value(result)),
    };
  });
  return {
    reads,
    loading: reads.some(({ result }) => AsyncResult.isInitial(result)),
    neverRead: reads.some(
      ({ result, inventory }) =>
        AsyncResult.isFailure(result) && inventory === undefined,
    ),
  };
}

function navigator(connections: readonly RuntimeConnection[]) {
  return Atom.readable((get) => {
    const state = get(worktreeNavigatorState);
    const query = state.query;
    const all: NavigatorProject[] = [];
    const inventories = connectionInventories(get, connections);
    for (const { connection, inventory } of inventories.reads) {
      for (const project of inventory?.projects ?? []) {
        const key = `${connection.environmentId}/${project.id}`;
        all.push({
          key,
          connection,
          project,
          environmentName: inventory!.environment.name,
          environmentIcon: environmentIcon(inventory!.environment),
          expanded: query.trim().length > 0 || state.expanded[key] !== false,
          entries: [],
        });
      }
    }
    all.sort(
      (a, b) =>
        a.project.name.localeCompare(b.project.name) ||
        a.environmentName.localeCompare(b.environmentName) ||
        a.key.localeCompare(b.key),
    );
    const filters = navigatorFilterSections(
      all.map((source) => ({
        key: source.key,
        name: source.project.name,
        environmentId: source.connection.environmentId,
        environmentName: source.environmentName,
        environmentIcon: source.environmentIcon,
      })),
      state.filter,
    );
    const projects: NavigatorProject[] = [];
    for (const source of all) {
      if (
        !navigatorProjectVisible(
          source.key,
          source.connection.environmentId,
          state.filter,
        )
      )
        continue;
      if (!source.expanded) {
        projects.push(source);
        continue;
      }
      const input = {
        connection: source.connection,
        projectId: source.project.id,
      };
      const entries = get(readNavigatorProject(input))
        .filter((entry) => navigatorEntryMatches(entry, query))
        .map((entry): NavigatorEntry => ({
          ...entry,
          pullRequest: { ...entry.pullRequest },
          changes: { ...entry.changes },
        }));
      for (const entry of entries) {
        if (entry.pullRequest.state === 'available') {
          const result = get(
            readProjectPullChecks({
              connection: source.connection,
              projectId: entry.projectId,
              number: entry.pullRequest.number,
            }),
          );
          const value = Option.getOrUndefined(AsyncResult.value(result));
          entry.pullRequest.checks = { state: 'loading' };
          if (
            AsyncResult.isFailure(result) ||
            (value &&
              (value.kind !== 'available' ||
                value.number !== entry.pullRequest.number))
          )
            entry.pullRequest.checks = { state: 'unavailable' };
          else if (value?.kind === 'available')
            entry.pullRequest.checks = {
              state: 'available',
              result: value.checks,
            };
        }
      }
      if (entries.length === 0 && query.trim()) continue;
      projects.push({ ...source, entries });
    }
    return {
      projects,
      allProjects: all,
      filters,
      loading: inventories.loading,
      neverRead: inventories.neverRead,
    };
  });
}

export const readWorktreeNavigator = Atom.family(
  (connections: readonly RuntimeConnection[]) => navigator(connections),
);
