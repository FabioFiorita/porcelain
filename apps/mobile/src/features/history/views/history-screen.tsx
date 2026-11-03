import { useRouter } from 'expo-router';
import { Empty } from '../../../components/ui/empty';
import { WorkspaceGate } from '../../projects';
import { HistoryNavigation } from './history-navigation';

export function HistoryScreen({
  workspace,
}: {
  workspace?: string | undefined;
}) {
  const router = useRouter();
  return (
    <WorkspaceGate
      title="History"
      expectedWorkspace={workspace}
      changed={
        <Empty
          title="Workspace changed"
          description="Another worktree is selected now. Open History again from the worktree you want."
        />
      }
    >
      {(current) => (
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
      )}
    </WorkspaceGate>
  );
}
