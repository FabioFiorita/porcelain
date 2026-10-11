import type { ReactNode } from 'react';
import { Box } from '../../../components/ui/box';
import { Empty } from '../../../components/ui/empty';
import { ErrorState } from '../../../components/ui/error-state';
import { Loading } from '../../../components/ui/loading';
import { useReadEnvironments } from '../../access';
import { useProjectSelectionCommands } from '../commands/selection';
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
  const { state, inventory } = useWorkspace();
  const readEnvironments = useReadEnvironments();
  const commands = useProjectSelectionCommands();
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
              onPress: () => {
                switch (state.source) {
                  case 'storage':
                    readEnvironments();
                    break;
                  case 'selection':
                    commands.submit({ kind: 'read' });
                    break;
                  case 'inventory':
                    inventory.read();
                    break;
                  default:
                    state.source satisfies never;
                }
              },
              pending: inventory.result.waiting || commands.pending > 0,
            }}
          />
        </Box>
      );
    case 'unavailable':
      return (
        <Empty
          title="Workspace unavailable"
          description={state.reason}
          action={{ label: 'Read again', onPress: inventory.read }}
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
