import { Cause, Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { worktreeLabel } from '@porcelain/client/projects/rules';
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
  const { environments, access, selection, inventory, remembered } = workspace;
  const commands = useProjectSelectionCommands();
  const inventories = useInventories();
  const project = workspace.project;
  const worktree = workspace.worktree;
  const unavailable = worktree && (!project?.available || !worktree.available);
  const label = worktree
    ? `${project?.name} · ${worktreeLabel(worktree.branch)}${unavailable ? ' (unavailable)' : ''}`
    : 'Workspace';
  const entries = environments.map((remote) => {
    const result = inventories.results.find(
      (entry) => entry.connection.environmentId === remote.environmentId,
    )?.result;
    const data = result && Option.getOrUndefined(AsyncResult.value(result));
    const failed = result !== undefined && AsyncResult.isFailure(result);
    return {
      environmentId: remote.environmentId,
      environmentName: data?.environment.name ?? remote.name,
      projects: data?.projects ?? [],
      unavailable: failed,
      message:
        !result || AsyncResult.isInitial(result)
          ? 'Reading projects…'
          : failed
            ? 'Could not read projects'
            : data?.projects.length === 0
              ? 'No projects registered'
              : undefined,
    };
  });
  const messages =
    environments.length === 0
      ? ['No environments paired']
      : entries.flatMap((entry) =>
          entry.message ? [`${entry.environmentName} · ${entry.message}`] : [],
        );
  if (
    remembered &&
    (!worktree || unavailable) &&
    !AsyncResult.isInitial(inventory.result)
  )
    messages.push('Saved worktree is unavailable');
  return (
    <WorkspaceMenu
      presentation={presentation}
      label={label}
      environmentId={selection.currentEnvironmentId}
      projects={entries.flatMap((entry) =>
        entry.projects.map((project) => ({
          environmentId: entry.environmentId,
          environmentName: entry.environmentName,
          project,
          unavailable: entry.unavailable,
        })),
      )}
      projectId={remembered?.projectId}
      worktreeId={remembered?.worktreeId}
      disabled={
        access.status !== 'ready' ||
        selection.status !== 'ready' ||
        commands.pending > 0
      }
      messages={messages}
      canReadInventory={entries.some((entry) => entry.unavailable)}
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
