import { workspaceSelection } from './workspace-selection.ts';
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
  const decision = workspaceSelection({
    storage: { status: 'ready', error: undefined },
    selection: { status: 'ready', error: undefined },
    remembered: saved,
    paired: environment !== undefined,
    inventory:
      environment?.status === 'ready' && environment.inventory
        ? { status: 'ready', inventory: environment.inventory }
        : { status: 'reading' },
  });
  return decision.kind === 'unavailable' ? decision.reason : undefined;
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
  const unavailableReason = saved && savedUnavailable(environments, saved);
  if (unavailableReason) messages.push(unavailableReason);
  return {
    choices,
    messages,
    canReadAgain: environments.some(
      (environment) => environment.status === 'failed',
    ),
  };
}
