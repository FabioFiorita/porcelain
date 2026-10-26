import type { ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { Box } from '../../../components/ui/box';
import { Empty } from '../../../components/ui/empty';
import { ErrorState } from '../../../components/ui/error-state';
import { Loading } from '../../../components/ui/loading';
import { isTablet } from '../../../shared/navigation/is-tablet';
import type { Workspace } from '../commands/workspace-connection';
import { useWorkspace } from './workspace';
import { useOpenComputers } from './open-computers';

const unframed = (content: ReactNode) => content;

export function WorkspaceGate({
  title,
  expectedWorkspace,
  changed,
  fallbackFrame = unframed,
  children,
}: {
  title: string;
  expectedWorkspace?: string | undefined;
  changed?: ReactNode;
  fallbackFrame?: (content: ReactNode) => ReactNode;
  children: (workspace: Workspace) => ReactNode;
}) {
  const { state, read, reading, remote, environments } = useWorkspace();
  const router = useRouter();
  const openComputers = useOpenComputers();
  switch (state.kind) {
    case 'loading':
      return fallbackFrame(<Loading label="Reading workspace…" />);
    case 'failed':
      return fallbackFrame(
        <Box padding={4}>
          <ErrorState
            message={state.message}
            retry={{
              label: 'Read again',
              onPress: read,
              pending: reading,
            }}
          />
        </Box>,
      );
    case 'unavailable':
      return fallbackFrame(
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
        />,
      );
    case 'none':
      return fallbackFrame(
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
              description={
                isTablet
                  ? `Choose a worktree in the sidebar to continue to ${title}.`
                  : `Choose a project and worktree with the workspace filter in the toolbar to continue to ${title}.`
              }
            />
          )),
      );
    case 'selected':
      return expectedWorkspace !== undefined &&
        state.workspace.key !== expectedWorkspace
        ? fallbackFrame(changed)
        : children(state.workspace);
    default:
      return state satisfies never;
  }
}
