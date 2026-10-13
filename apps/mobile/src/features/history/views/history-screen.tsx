import { createContext, useContext } from 'react';
import { useRouter } from 'expo-router';
import { Empty } from '../../../components/ui/empty';
import { WorkspaceGate } from '../../projects';
import { HistoryNavigation } from './history-navigation';

export const HistoryPaneContext = createContext(false);

export function HistoryScreen() {
  const wide = useContext(HistoryPaneContext);
  const router = useRouter();
  return (
    <WorkspaceGate title="History">
      {(current) =>
        wide ? (
          <Empty
            title="Select a commit"
            description="Choose a commit from History to see its changes."
            icon="history"
          />
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
