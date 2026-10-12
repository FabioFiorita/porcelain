import {
  useEnvironments,
  useEnvironmentStorageStatus,
  useReadEnvironments,
} from '../../access';
import { workspaceReadiness } from '@porcelain/client/projects';
import { useProjectSelection } from '../store';
import { useWorkspaceConnection } from '../commands/workspace-connection';
import { useProjectSelectionCommands } from '../commands/selection';

export function useWorkspace() {
  const environments = useEnvironments();
  const access = useEnvironmentStorageStatus();
  const selection = useProjectSelection();
  const readEnvironments = useReadEnvironments();
  const commands = useProjectSelectionCommands();
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
    workspaceReadiness(access, selection),
  );
  const read = () => {
    const source =
      connected.state.kind === 'failed' ? connected.state.source : 'inventory';
    switch (source) {
      case 'storage':
        readEnvironments();
        break;
      case 'selection':
        commands.submit({ kind: 'read' });
        break;
      case 'inventory':
        connected.inventory.read();
        break;
      default:
        source satisfies never;
    }
  };
  return {
    environments,
    access,
    selection,
    remote,
    remembered,
    ...connected,
    read,
    reading: connected.inventory.result.waiting || commands.pending > 0,
  };
}
