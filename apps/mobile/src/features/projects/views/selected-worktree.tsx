import {
  useEnvironments,
  useEnvironmentStorageStatus,
  pairingPlatform,
} from '../../access';
import { useProjectSelection } from '../store';
import { useWorkspaceConnection } from '../queries/connection';

export function useWorkspace() {
  const environments = useEnvironments();
  const access = useEnvironmentStorageStatus();
  const selection = useProjectSelection();
  const remote = environments.find(
    (environment) =>
      environment.environmentId === selection.currentEnvironmentId,
  );
  const remembered = selection.currentEnvironmentId
    ? selection.selections[selection.currentEnvironmentId]
    : undefined;
  const connected = useWorkspaceConnection(
    remote,
    pairingPlatform().send,
    remembered?.projectId,
    remembered?.worktreeId,
    access.status === 'ready' && selection.status === 'ready',
  );
  return { environments, access, selection, remote, remembered, ...connected };
}

export function useSelectedWorktree() {
  return useWorkspace().current;
}
