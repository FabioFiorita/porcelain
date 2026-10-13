import type { ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { Box } from '../../../components/ui/box';
import { Empty } from '../../../components/ui/empty';
import { ErrorState } from '../../../components/ui/error-state';
import { Loading } from '../../../components/ui/loading';
import type { Workspace } from '../commands/workspace-connection';
import { useWorkspace } from './workspace';

function WorkspaceFallback({
  toolbar,
  children,
}: {
  toolbar: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      {toolbar}
      {children}
    </>
  );
}

export function WorkspaceGate({
  title,
  expectedWorkspace,
  changed,
  fallbackToolbar,
  children,
}: {
  title: string;
  expectedWorkspace?: string | undefined;
  changed?: ReactNode;
  fallbackToolbar?: ReactNode;
  children: (workspace: Workspace) => ReactNode;
}) {
  const { state, read, reading, remote, environments } = useWorkspace();
  const router = useRouter();
  switch (state.kind) {
    case 'loading':
      return (
        <WorkspaceFallback toolbar={fallbackToolbar}>
          <Loading label="Reading workspace…" />
        </WorkspaceFallback>
      );
    case 'failed':
      return (
        <WorkspaceFallback toolbar={fallbackToolbar}>
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
        </WorkspaceFallback>
      );
    case 'unavailable':
      return (
        <WorkspaceFallback toolbar={fallbackToolbar}>
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
        </WorkspaceFallback>
      );
    case 'none':
      return (
        <WorkspaceFallback toolbar={fallbackToolbar}>
          {changed ??
            (environments.length === 0 ? (
              <Empty
                title="Pair an environment"
                description="Connect to a computer in Settings, then select a project and worktree."
                action={{
                  label: 'Open Settings',
                  onPress: () => router.push('/settings'),
                }}
              />
            ) : (
              <Empty
                title="Select a worktree"
                description={`Choose a project and worktree with the workspace filter in the toolbar to continue to ${title}.`}
              />
            ))}
        </WorkspaceFallback>
      );
    case 'selected':
      return expectedWorkspace !== undefined &&
        state.workspace.key !== expectedWorkspace ? (
        <WorkspaceFallback toolbar={fallbackToolbar}>
          {changed}
        </WorkspaceFallback>
      ) : (
        children(state.workspace)
      );
    default:
      return state satisfies never;
  }
}
