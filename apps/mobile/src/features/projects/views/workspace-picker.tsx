import { Cause, Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { worktreeLabel } from '@porcelain/client/projects/rules';
import { connectionErrorMessage } from '@porcelain/client/access/rules';
import { useProjectSelectionCommands } from '../commands/selection';
import { WorkspaceMenu } from './workspace-menu';
import { useWorkspace } from './selected-worktree';

export function WorkspacePicker({
  presentation,
}: {
  presentation: 'phone' | 'tablet';
}) {
  const workspace = useWorkspace();
  const {
    environments,
    access,
    selection,
    remote: environment,
    inventory,
    remembered,
  } = workspace;
  const commands = useProjectSelectionCommands();
  const data = Option.getOrUndefined(AsyncResult.value(inventory.result));
  const project = workspace.project;
  const worktree = workspace.worktree;
  const unavailable = worktree && (!project?.available || !worktree.available);
  const label = worktree
    ? `${project?.name} · ${worktreeLabel(worktree.branch)}${unavailable ? ' (unavailable)' : ''}`
    : (environment?.name ?? 'Workspace');
  const projectMessage = !environment
    ? 'Select an environment'
    : AsyncResult.isInitial(inventory.result)
      ? 'Reading projects…'
      : AsyncResult.isFailure(inventory.result)
        ? 'Could not read projects'
        : data?.projects.length === 0
          ? 'No projects registered'
          : remembered && (!worktree || unavailable)
            ? 'Saved worktree is unavailable'
            : undefined;
  return (
    <WorkspaceMenu
      presentation={presentation}
      label={label}
      environments={environments.map(({ environmentId, name }) => ({
        environmentId,
        name,
      }))}
      environmentId={selection.currentEnvironmentId}
      projects={data?.projects ?? []}
      projectId={remembered?.projectId}
      worktreeId={remembered?.worktreeId}
      disabled={
        access.status !== 'ready' ||
        selection.status !== 'ready' ||
        commands.pending > 0
      }
      projectMessage={projectMessage}
      error={
        selection.error ??
        (AsyncResult.isFailure(commands.result)
          ? connectionErrorMessage(Cause.squash(commands.result.cause))
          : undefined)
      }
      onRead={() => commands.submit({ kind: 'read' })}
      onReadInventory={inventory.read}
      onEnvironment={(environmentId) =>
        commands.submit({ kind: 'environment', environmentId })
      }
      onWorktree={(projectId, worktreeId) => {
        if (selection.currentEnvironmentId)
          commands.submit({
            kind: 'worktree',
            environmentId: selection.currentEnvironmentId,
            projectId,
            worktreeId,
          });
      }}
    />
  );
}
