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
      expectedWorkspace={workspace}
      changed={<Empty title="Another worktree is selected now." />}
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
