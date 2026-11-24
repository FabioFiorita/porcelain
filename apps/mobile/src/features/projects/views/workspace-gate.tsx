import type { ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { ReadingConnection } from '../../access';
import { Box } from '../../../components/ui/box';
import { Empty } from '../../../components/ui/empty';
import { ErrorState } from '../../../components/ui/error-state';
import { Spinner } from '../../../components/ui/spinner';
import { Screen } from '../../../components/ui/screen';
import type { Workspace } from '../commands/workspace-connection';
import { useWorkspace } from './workspace';
import { useOpenComputers } from './open-computers';

export function WorkspaceGate({
  expectedWorkspace,
  changed,
  unavailable,
  frame = 'screen',
  nested = false,
  children,
}: {
  expectedWorkspace?: string | undefined;
  changed?: ReactNode;
  unavailable?: ReactNode;
  frame?: 'screen' | 'pane';
  nested?: boolean;
  children: (workspace: Workspace) => ReactNode;
}) {
  const { state, read, reading, remote, environments } = useWorkspace();
  const router = useRouter();
  const openComputers = useOpenComputers();
  const notice = () => {
    switch (state.kind) {
      case 'loading':
        return <Spinner />;
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
              title={state.reason}
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
              action={{
                label: 'Add computer',
                onPress: openComputers,
              }}
            />
          ) : (
            <Empty title="Select a worktree" />
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
    return nested || !remote ? (
      children(state.workspace)
    ) : (
      <View className="flex-1" collapsable={false}>
        {children(state.workspace)}
        <ReadingConnection remote={remote} />
      </View>
    );
  return frame === 'screen' ? (
    <Screen layout="fixed">{notice()}</Screen>
  ) : (
    <Box className="flex-1">{notice()}</Box>
  );
}
