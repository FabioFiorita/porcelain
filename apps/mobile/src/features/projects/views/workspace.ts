import { useEnvironments, useEnvironmentStorageStatus } from '../../access';
import { useProjectSelection } from '../store';
import { useWorkspaceConnection } from '../commands/workspace-connection';

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
    remembered,
    access,
    selection,
  );
  return { environments, access, selection, remote, remembered, ...connected };
}
