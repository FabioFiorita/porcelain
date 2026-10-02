import { worktreeLabel } from '@porcelain/client/projects/rules';
import {
  useEnvironments,
  useEnvironmentStorageStatus,
  pairingPlatform,
  environmentSelectionAccess,
} from '../../access';
import { useProjectSelection } from '../store';
import { useInventory } from '../queries/inventory';
import { useProjectSelectionCommands } from '../commands/selection';
import { WorkspaceMenu } from './workspace-menu';

export function WorkspacePicker({
  presentation,
}: {
  presentation: 'phone' | 'tablet';
}) {
  const environments = useEnvironments();
  const access = useEnvironmentStorageStatus();
  const selection = useProjectSelection();
  const environment = environments.find(
    (candidate) => candidate.environmentId === selection.currentEnvironmentId,
  );
  const inventory = useInventory(environment, pairingPlatform().send);
  const commands = useProjectSelectionCommands(environmentSelectionAccess);
  const remembered = selection.currentEnvironmentId
    ? selection.selections[selection.currentEnvironmentId]
    : undefined;
  const project = inventory.data?.projects.find(
    (candidate) => candidate.id === remembered?.projectId,
  );
  const worktree = project?.worktrees.find(
    (candidate) => candidate.id === remembered?.worktreeId,
  );
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
