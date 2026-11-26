import { useState, type ReactNode } from 'react';
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
import { useWorktreeDrawer } from './worktree-drawer';
import { workspaceGateContent } from '../rules/workspace-gate';
import { workspaceKey } from '../rules/workspace-key';

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
  const { state, read, reading, remote, environments, selection, remembered } =
    useWorkspace();
  const [shown, setShown] = useState<Workspace | undefined>(undefined);
  if (
    state.kind === 'selected' &&
    (state.workspace.key !== shown?.key ||
      state.workspace.connection !== shown.connection)
  )
    setShown(state.workspace);
  const content = workspaceGateContent({
    state,
    shown,
    remembered:
      selection.currentEnvironmentId && remembered
        ? workspaceKey(
            { environmentId: selection.currentEnvironmentId },
            remembered,
          )
        : undefined,
    expected: expectedWorkspace,
    nested,
    remote: remote !== undefined,
  });
  const router = useRouter();
  const openComputers = useOpenComputers();
  const drawer = useWorktreeDrawer();
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
                      onPress: () => router.navigate('/settings'),
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
            <Empty
              title="No worktree selected"
              action={{
                label: 'Choose worktree',
                onPress: drawer.show,
              }}
            />
          ))
        );
      case 'selected':
        return changed;
      default:
        return state satisfies never;
    }
  };
  if (content.kind === 'reading')
    return content.notice && remote ? (
      <View className="flex-1" collapsable={false}>
        {children(content.workspace)}
        <ReadingConnection remote={remote} />
      </View>
    ) : (
      children(content.workspace)
    );
  return frame === 'screen' ? (
    <Screen layout="fixed">{notice()}</Screen>
  ) : (
    <Box className="flex-1">{notice()}</Box>
  );
}
