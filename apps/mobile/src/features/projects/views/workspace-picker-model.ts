import { Cause } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import {
  workspaceChoices,
  worktreeLabel,
} from '@porcelain/client/projects/rules';
import { connectionErrorMessage } from '@porcelain/client/access/rules';
import { useProjectSelectionCommands } from '../commands/selection';
import { useInventories } from '../queries/inventory';
import { useWorkspace } from './workspace';
import type { WorkspaceMenuProps } from './workspace-menu-props';

export function useWorkspacePickerModel() {
  const workspace = useWorkspace();
  const { environments, access, selection, remembered } = workspace;
  const commands = useProjectSelectionCommands();
  const inventories = useInventories(environments);
  const project = workspace.project;
  const worktree = workspace.worktree;
  const unavailable = workspace.state.kind === 'unavailable';
  const label = worktree
    ? `${project?.name} · ${worktreeLabel(worktree.branch)}${unavailable ? ' (unavailable)' : ''}`
    : 'Workspace';
  const { choices, messages, canReadAgain } = workspaceChoices(
    inventories.environments,
    selection.currentEnvironmentId && remembered
      ? { environmentId: selection.currentEnvironmentId, ...remembered }
      : undefined,
  );
  const picker = {
    label,
    environmentId: selection.currentEnvironmentId,
    choices,
    projectId: remembered?.projectId,
    worktreeId: remembered?.worktreeId,
    disabled:
      access.status !== 'ready' ||
      selection.status !== 'ready' ||
      commands.pending > 0,
    messages,
    canReadInventory: canReadAgain,
    error:
      (workspace.state.kind === 'failed'
        ? workspace.state.message
        : undefined) ??
      (AsyncResult.isFailure(commands.result)
        ? connectionErrorMessage(Cause.squash(commands.result.cause))
        : undefined),
    onRead:
      workspace.state.kind === 'failed'
        ? workspace.read
        : () => commands.submit({ kind: 'read' }),
    onReadInventory: inventories.read,
    onWorktree: (
      environmentId: string,
      projectId: string,
      worktreeId: string,
    ) =>
      commands.submit({
        kind: 'workspace',
        environmentId,
        projectId,
        worktreeId,
      }),
  } satisfies WorkspaceMenuProps;
  return {
    picker,
    groups: inventories.environments.map((environment) => ({
      key: environment.environmentId,
      name: environment.inventory?.environment.name ?? environment.name,
      choices: choices.filter(
        (choice) => choice.environmentId === environment.environmentId,
      ),
    })),
    initializing: access.status === 'loading' || selection.status === 'loading',
    reading: workspace.reading || inventories.reading,
  };
}
