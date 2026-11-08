import type { ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { Box } from '../../../components/ui/box';
import { Empty } from '../../../components/ui/empty';
import { ErrorState } from '../../../components/ui/error-state';
import { Loading } from '../../../components/ui/loading';
import { Screen } from '../../../components/ui/screen';
import type { Workspace } from '../commands/workspace-connection';
import { useWorkspace } from './workspace';
import { useOpenComputers } from './open-computers';

export function WorkspaceGate({
  title,
  expectedWorkspace,
  changed,
  unavailable,
  frame = 'screen',
  children,
}: {
  title: string;
  expectedWorkspace?: string | undefined;
  changed?: ReactNode;
  unavailable?: ReactNode;
  frame?: 'screen' | 'pane';
  children: (workspace: Workspace) => ReactNode;
}) {
  const { state, read, reading, remote, environments } = useWorkspace();
  const router = useRouter();
  const openComputers = useOpenComputers();
  const notice = () => {
    switch (state.kind) {
      case 'loading':
        return <Loading label="Reading workspace…" />;
      case 'failed':
        return (
          <Box padding={4}>
            <ErrorState
              message={state.message}
              retry={{
                label: 'Read again',
                onPress: read,
                pending: reading,
              }}
            />
          </Box>
        );
      case 'unavailable':
        return (
          unavailable ?? (
            <Empty
              title="Workspace unavailable"
              description={state.reason}
              action={
                remote
                  ? { label: 'Read again', onPress: read }
                  : {
                      label: 'Open Settings',
                      onPress: () => router.push('/settings'),
                    }
              }
            />
          )
        );
      case 'none':
        return (
          changed ??
          (environments.length === 0 ? (
            <Empty
              title="Pair a computer"
              description="Pair a computer, then select a project and worktree."
              action={{
                label: 'Add computer',
                onPress: openComputers,
              }}
            />
          ) : (
            <Empty
              title="Select a worktree"
              description={`Choose a worktree in Worktrees to continue to ${title}.`}
            />
          ))
        );
      case 'selected':
        return changed;
      default:
        return state satisfies never;
    }
  };
  if (
    state.kind === 'selected' &&
    (expectedWorkspace === undefined ||
      state.workspace.key === expectedWorkspace)
  )
    return children(state.workspace);
  return frame === 'screen' ? (
    <Screen layout="fixed">{notice()}</Screen>
  ) : (
    <Box className="flex-1">{notice()}</Box>
  );
}
