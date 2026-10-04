import { worktreeLabel } from '@porcelain/client/projects/rules';
import { environmentSelectionAccess } from '../../access';
import { useProjectSelectionCommands } from '../commands/selection';
import { WorkspaceMenu } from './workspace-menu';
import { useSelectedWorktree, useWorkspace } from './selected-worktree';

export function WorkspacePicker({
  presentation,
}: {
  presentation: 'phone' | 'tablet';
}) {
  const workspace = useWorkspace();
  const selected = useSelectedWorktree();
  const {
    environments,
    access,
    selection,
    remote: environment,
    inventory,
    remembered,
  } = workspace;
  const commands = useProjectSelectionCommands(environmentSelectionAccess);
  const project = selected?.project ?? workspace.project;
  const worktree = selected?.worktree ?? workspace.worktree;
  const unavailable = worktree && (!project?.available || !worktree.available);
  const label = worktree
    ? `${project?.name} · ${worktreeLabel(worktree.branch)}${unavailable ? ' (unavailable)' : ''}`
    : (environment?.name ?? 'Workspace');
  const projectMessage = !environment
    ? 'Select an environment'
    : inventory.isPending
      ? 'Reading projects…'
      : inventory.isError
        ? 'Could not read projects'
        : inventory.data?.projects.length === 0
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
      projects={inventory.data?.projects ?? []}
      projectId={remembered?.projectId}
      worktreeId={remembered?.worktreeId}
      disabled={
        access.status !== 'ready' ||
        selection.status !== 'ready' ||
        commands.isPending
      }
      projectMessage={projectMessage}
      error={selection.error ?? commands.error?.message}
      onRead={() => commands.onSubmit({ kind: 'read' })}
      onReadInventory={inventory.read}
      onEnvironment={(environmentId) =>
        commands.onSubmit({ kind: 'environment', environmentId })
      }
      onWorktree={(projectId, worktreeId) => {
        if (selection.currentEnvironmentId)
          commands.onSubmit({
            kind: 'worktree',
            environmentId: selection.currentEnvironmentId,
            projectId,
            worktreeId,
          });
      }}
    />
  );
}
