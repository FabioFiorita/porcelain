import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Empty } from '../../../components/ui/empty';
import { WorkspaceGate, type Workspace } from '../../projects';
import { Screen } from '../../../components/ui/screen';
import { CommitPage } from './commit-page';

export function CommitScreen({
  diffRoute = '/history/commit/[oid]/diff',
}: {
  diffRoute?: '/history/commit/[oid]/diff' | '/timeline-diff';
}) {
  const { oid, workspace, path } = useLocalSearchParams<{
    oid: string;
    workspace?: string;
    path?: string;
  }>();
  return (
    <WorkspaceGate
      expectedWorkspace={workspace}
      changed={<Empty title="Another worktree is selected now." />}
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

export function CommitPane({
  current,
  oid,
}: {
  current: Workspace;
  oid: string;
}) {
  return (
    <CommitDetail
      current={current}
      oid={oid}
      diffRoute="/history/commit/[oid]/diff"
      selectedPath={undefined}
      place="pane"
    />
  );
}

function CommitDetail({
  current,
  oid,
  diffRoute,
  selectedPath,
  place = 'screen',
}: {
  current: Workspace;
  oid: string;
  diffRoute: '/history/commit/[oid]/diff' | '/timeline-diff';
  selectedPath: string | undefined;
  place?: 'screen' | 'pane' | undefined;
}) {
  const [parent, setParent] = useState(1);
  const router = useRouter();
  return (
    <Screen layout="fixed">
      <CommitPage
        key={parent}
        surface={place}
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
    </Screen>
  );
}
