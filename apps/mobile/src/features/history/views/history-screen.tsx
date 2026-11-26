import { useAtom } from '@effect/atom-react';
import { useRouter } from 'expo-router';
import { Empty } from '../../../components/ui/empty';
import { ListDetail } from '../../../components/ui/list-detail';
import type { ListDetailMode } from '../../../shared/rules/list-detail';
import { WorkspaceGate, type Workspace } from '../../projects';
import { CommitPane } from './commit-screen';
import { HistoryNavigation } from './history-navigation';
import { besideCommit } from '../store';
import { useHistory } from '../queries/history';

export function HistoryScreen({
  workspace,
  nested = false,
  mode = 'stack',
}: {
  workspace?: string | undefined;
  nested?: boolean;
  mode?: ListDetailMode | undefined;
}) {
  return (
    <WorkspaceGate
      expectedWorkspace={workspace}
      nested={nested}
      changed={<Empty title="Another worktree is selected now." />}
    >
      {(current) => (
        <HistoryLayout key={current.key} current={current} mode={mode} />
      )}
    </WorkspaceGate>
  );
}

function HistoryLayout({
  current,
  mode,
}: {
  current: Workspace;
  mode: ListDetailMode;
}) {
  const router = useRouter();
  const [chosen, setOpened] = useAtom(besideCommit(current.key));
  const latest = useHistory(current).value?.commits[0]?.oid;
  const opened = chosen ?? latest;
  const navigation = (
    <HistoryNavigation
      selection={current}
      workspace={current.key}
      {...(mode === 'beside' && opened ? { selected: opened } : {})}
      onOpen={(oid, workspace) =>
        mode === 'beside'
          ? setOpened(oid)
          : router.push({
              pathname: '/history/commit/[oid]',
              params: { oid, workspace },
            })
      }
    />
  );
  if (mode === 'stack') return navigation;
  return (
    <ListDetail
      list={() => navigation}
      detail={
        opened ? (
          <CommitPane key={opened} current={current} oid={opened} />
        ) : (
          <Empty title="Select a commit" />
        )
      }
    />
  );
}
