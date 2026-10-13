import { workspaceSelection } from './workspace-selection.ts';
import {
  projectUnavailableMessage,
  type Inventory,
  type Project,
} from './inventory.ts';

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
    readiness: {
      environmentsReady: true,
      selectionReady: true,
      failure: undefined,
    },
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
  messages.push(
    ...choices
      .filter(
        ({ project, environmentId }) =>
          !project.available &&
          !(
            unavailableReason &&
            saved?.environmentId === environmentId &&
            saved.projectId === project.id
          ),
      )
      .map(
        ({ project, environmentName }) =>
          `${environmentName} · ${project.name}: ${projectUnavailableMessage(project)}`,
      ),
  );
  if (unavailableReason) messages.push(unavailableReason);
  return {
    choices,
    messages,
    canReadAgain:
      choices.some(
        ({ project }) =>
          !project.available ||
          project.worktrees.some((worktree) => !worktree.available),
      ) || environments.some((environment) => environment.status === 'failed'),
  };
}
