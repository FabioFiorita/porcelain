import type { ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { Box } from '../../../components/ui/box';
import { Empty } from '../../../components/ui/empty';
import { ErrorState } from '../../../components/ui/error-state';
import { Loading } from '../../../components/ui/loading';
import type { Workspace } from '../commands/workspace-connection';
import { useWorkspace } from './workspace';

export function WorkspaceGate({
  title,
  expectedWorkspace,
  changed,
  children,
}: {
  title: string;
  expectedWorkspace?: string | undefined;
  changed?: ReactNode;
  children: (workspace: Workspace) => ReactNode;
}) {
  const { state, read, reading, remote } = useWorkspace();
  const router = useRouter();
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
      );
    case 'none':
      return (
        changed ?? (
          <Empty title={title} description="Select a worktree to continue." />
        )
      );
    case 'selected':
      return expectedWorkspace !== undefined &&
        state.workspace.key !== expectedWorkspace
        ? changed
        : children(state.workspace);
    default:
      return state satisfies never;
  }
}
