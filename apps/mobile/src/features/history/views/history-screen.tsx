import { useRouter } from 'expo-router';
import { WorkspaceGate } from '../../projects';
import { isTablet } from '../../../shared/navigation/is-tablet';
import { HistoryNavigation } from './history-navigation';
import { HistoryWorkspace } from './history-workspace';

export function HistoryScreen() {
  const router = useRouter();
  return (
    <WorkspaceGate title="History">
      {(current) =>
        isTablet ? (
          <HistoryWorkspace key={current.key} current={current} />
        ) : (
          <HistoryNavigation
            key={current.key}
            selection={current}
            workspace={current.key}
            onOpen={(oid, workspace) =>
              router.push({
                pathname: '/history/commit/[oid]',
                params: { oid, workspace },
              })
            }
          />
        )
      }
    </WorkspaceGate>
  );
}
