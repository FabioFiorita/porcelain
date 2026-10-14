import { useState } from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Empty } from '../../../components/ui/empty';
import { headerIcon } from '../../../shared/icons/header-icon';
import { WorkspaceGate, type Workspace } from '../../projects';
import { shortOid } from '@porcelain/client/history/rules';
import { CommitContent } from './commit-content';

export function CommitScreen() {
  const { oid, workspace } = useLocalSearchParams<{
    oid: string;
    workspace?: string;
  }>();
  return (
    <WorkspaceGate
      title="History"
      expectedWorkspace={workspace}
      changed={
        <Empty
          title="Workspace changed"
          description="Return to History to open a commit in the selected worktree."
        />
      }
    >
      {(current) => (
        <CommitDetail
          key={`${current.key}:${oid}`}
          current={current}
          oid={oid}
        />
      )}
    </WorkspaceGate>
  );
}

function CommitDetail({ current, oid }: { current: Workspace; oid: string }) {
  const [parent, setParent] = useState(1);
  const router = useRouter();
  return (
    <>
      <Stack.Screen options={{ title: shortOid(oid) }} />
      <CommitContent
        selection={current}
        oid={oid}
        parent={parent}
        onParentChange={setParent}
        onOpenFile={(path) =>
          router.push({
            pathname: '/history/commit/[oid]/diff',
            params: {
              oid,
              workspace: current.key,
              parent: String(parent),
              path,
            },
          })
        }
        renderParentMenu={(parentOids) => (
          <Stack.Toolbar placement="right">
            <Stack.Toolbar.Menu
              icon={headerIcon('compareParent')}
              accessibilityLabel="Compare parent"
              title="Compare parent"
            >
              {parentOids.map((parentOid, index) => (
                <Stack.Toolbar.MenuAction
                  key={parentOid}
                  isOn={parent === index + 1}
                  onPress={() => setParent(index + 1)}
                >{`Parent ${index + 1} · ${shortOid(parentOid)}`}</Stack.Toolbar.MenuAction>
              ))}
            </Stack.Toolbar.Menu>
          </Stack.Toolbar>
        )}
      />
    </>
  );
}
