import { Stack, useLocalSearchParams } from 'expo-router';
import { Empty } from '../../../components/ui/empty';
import { WorkspaceGate } from '../../projects';
import { DiffContent } from './diff-content';

export function CommitDiffScreen() {
  const {
    oid,
    workspace,
    path,
    parent: requestedParent,
  } = useLocalSearchParams<{
    oid: string;
    workspace?: string;
    path: string;
    parent?: string;
  }>();
  const parent = Number(requestedParent ?? 1);
  const changed = (
    <Empty
      title="Workspace changed"
      description="Return to History to open a commit in the selected worktree."
    />
  );
  return (
    <WorkspaceGate
      title="History"
      expectedWorkspace={workspace}
      changed={changed}
    >
      {(current) =>
        Number.isInteger(parent) && parent > 0 ? (
          <>
            <Stack.Screen
              options={{ title: path.split('/').at(-1) ?? 'Diff' }}
            />
            <DiffContent
              key={`${current.key}:${oid}:${parent}:${path}`}
              selection={current}
              oid={oid}
              parent={parent}
              path={path}
              inlineComments
            />
          </>
        ) : (
          changed
        )
      }
    </WorkspaceGate>
  );
}
