import { useRouter } from 'expo-router';
import { WorkspaceGate } from '../../projects';
import { HistoryNavigation } from './history-navigation';

export function HistoryScreen() {
  const router = useRouter();
  return (
    <WorkspaceGate title="History">
      {(current) => (
        <HistoryNavigation
          key={current.key}
          selection={current}
          workspace={current.key}
          project={current.project.name}
          onOpen={(oid, workspace) =>
            router.push({
              pathname: '/history/commit/[oid]',
              params: { oid, workspace },
            })
          }
        />
      )}
    </WorkspaceGate>
  );
}
