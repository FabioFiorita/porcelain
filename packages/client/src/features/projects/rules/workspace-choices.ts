import type { Inventory, Project } from './inventory.ts';

export type EnvironmentInventory = {
  readonly environmentId: string;
  readonly name: string;
  readonly status: 'reading' | 'failed' | 'ready';
  readonly inventory: Inventory | undefined;
};

export type SavedWorkspace = {
  readonly environmentId: string;
  readonly projectId: string;
  readonly worktreeId: string;
};

export type WorkspaceChoice = {
  readonly key: string;
  readonly environmentId: string;
  readonly environmentName: string;
  readonly project: Project;
  readonly unavailable: boolean;
};

function nameOf(environment: EnvironmentInventory) {
  return environment.inventory?.environment.name ?? environment.name;
}

function statusOf(environment: EnvironmentInventory) {
  if (environment.status === 'reading') return 'Reading projects…';
  if (environment.status === 'failed') return 'Could not read projects';
  if (environment.inventory?.projects.length === 0)
    return 'No projects registered';
  return undefined;
}

function savedUnavailable(
  environments: readonly EnvironmentInventory[],
  saved: SavedWorkspace,
) {
  const environment = environments.find(
    (entry) => entry.environmentId === saved.environmentId,
  );
  if (environment === undefined) return true;
  if (environment.status !== 'ready') return false;
  const project = environment.inventory?.projects.find(
    (entry) => entry.id === saved.projectId,
  );
  const worktree = project?.worktrees.find(
    (entry) => entry.id === saved.worktreeId,
  );
  return !project?.available || !worktree?.available;
}

export function workspaceChoices(
  environments: readonly EnvironmentInventory[],
  saved: SavedWorkspace | undefined,
) {
  const choices: WorkspaceChoice[] = environments.flatMap((environment) =>
    (environment.inventory?.projects ?? []).map((project) => ({
      key: `${environment.environmentId}/${project.id}`,
      environmentId: environment.environmentId,
      environmentName: nameOf(environment),
      project,
      unavailable: environment.status === 'failed',
    })),
  );
  const messages =
    environments.length === 0
      ? ['No environments paired']
      : environments.flatMap((environment) => {
          const status = statusOf(environment);
          return status ? [`${nameOf(environment)} · ${status}`] : [];
        });
  if (saved !== undefined && savedUnavailable(environments, saved))
    messages.push('Saved worktree is unavailable');
  return {
    choices,
    messages,
    canReadAgain: environments.some(
      (environment) => environment.status === 'failed',
    ),
  };
}
