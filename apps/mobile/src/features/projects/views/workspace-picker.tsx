import { Cause } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import {
  workspaceChoices,
  worktreeLabel,
} from '@porcelain/client/projects/rules';
import { connectionErrorMessage } from '@porcelain/client/access/rules';
import { useProjectSelectionCommands } from '../commands/selection';
import { WorkspaceMenu } from './workspace-menu';
import { useWorkspace } from './selected-worktree';
import { useInventories } from '../queries/inventory';

export function WorkspacePicker({
  presentation,
}: {
  presentation: 'phone' | 'tablet';
}) {
  const workspace = useWorkspace();
  const { environments, access, selection, remembered } = workspace;
  const commands = useProjectSelectionCommands();
  const inventories = useInventories(environments);
  const project = workspace.project;
  const worktree = workspace.worktree;
  const unavailable = worktree && (!project?.available || !worktree.available);
  const label = worktree
    ? `${project?.name} · ${worktreeLabel(worktree.branch)}${unavailable ? ' (unavailable)' : ''}`
    : 'Workspace';
  const { choices, messages, canReadAgain } = workspaceChoices(
    inventories.environments,
    selection.currentEnvironmentId && remembered
      ? { environmentId: selection.currentEnvironmentId, ...remembered }
      : undefined,
  );
  return (
    <WorkspaceMenu
      presentation={presentation}
      label={label}
      environmentId={selection.currentEnvironmentId}
      choices={choices}
      projectId={remembered?.projectId}
      worktreeId={remembered?.worktreeId}
      disabled={
        access.status !== 'ready' ||
        selection.status !== 'ready' ||
        commands.pending > 0
      }
      messages={messages}
      canReadInventory={canReadAgain}
      error={
        selection.error ??
        (AsyncResult.isFailure(commands.result)
          ? connectionErrorMessage(Cause.squash(commands.result.cause))
          : undefined)
      }
      onRead={() => commands.submit({ kind: 'read' })}
      onReadInventory={inventories.read}
      onWorktree={(environmentId, projectId, worktreeId) =>
        commands.submit({
          kind: 'workspace',
          environmentId,
          projectId,
          worktreeId,
        })
      }
    />
  );
}
