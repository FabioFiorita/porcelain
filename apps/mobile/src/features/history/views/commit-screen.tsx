import { useState } from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Empty } from '../../../components/ui/empty';
import { WorkspaceGate, type Workspace } from '../../projects';
import { shortOid } from '@porcelain/client/history/rules';
import { CommitContent } from './commit-content';

export function CommitScreen({
  diffRoute = '/history/commit/[oid]/diff',
  returnTo = 'History',
}: {
  diffRoute?: '/history/commit/[oid]/diff' | '/timeline-diff';
  returnTo?: 'History' | 'Files';
}) {
  const { oid, workspace, path } = useLocalSearchParams<{
    oid: string;
    workspace?: string;
    path?: string;
  }>();
  return (
    <WorkspaceGate
      title="History"
      expectedWorkspace={workspace}
      changed={
        <Empty
          title="Workspace changed"
          description={`Return to ${returnTo} to open a commit in the selected worktree.`}
        />
      }
    >
      {(current) => (
        <CommitDetail
          key={`${current.key}:${oid}`}
          current={current}
          oid={oid}
          diffRoute={diffRoute}
          selectedPath={path}
        />
      )}
    </WorkspaceGate>
  );
}

function CommitDetail({
  current,
  oid,
  diffRoute,
  selectedPath,
}: {
  current: Workspace;
  oid: string;
  diffRoute: '/history/commit/[oid]/diff' | '/timeline-diff';
  selectedPath: string | undefined;
}) {
  const [parent, setParent] = useState(1);
  const router = useRouter();
  return (
    <>
      <Stack.Screen options={{ title: shortOid(oid) }} />
      <CommitContent
        key={parent}
        selection={current}
        oid={oid}
        parent={parent}
        selectedPath={selectedPath}
        onParentChange={setParent}
        onOpenFile={(path) =>
          router.push({
            pathname: diffRoute,
            params: {
              oid,
              workspace: current.key,
              parent: String(parent),
              path,
            },
          })
        }
      />
    </>
  );
}
