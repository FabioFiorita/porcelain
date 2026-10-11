import type { ReactNode } from 'react';
import { Box } from '../../../components/ui/box';
import { Empty } from '../../../components/ui/empty';
import { ErrorState } from '../../../components/ui/error-state';
import { Loading } from '../../../components/ui/loading';
import { useReadEnvironments } from '../../access';
import { useProjectSelectionCommands } from '../commands/selection';
import type { SelectedWorktree } from '../commands/workspace-connection';
import { useWorkspace } from './selected-worktree';

export function WorkspaceGate({
  title,
  children,
}: {
  title: string;
  children: (workspace: SelectedWorktree) => ReactNode;
}) {
  const { state, inventory, access, selection } = useWorkspace();
  const readEnvironments = useReadEnvironments();
  const commands = useProjectSelectionCommands();
  const retry = () => {
    if (access.status === 'unreadable') readEnvironments();
    else if (selection.status === 'unreadable')
      commands.submit({ kind: 'read' });
    else inventory.read();
  };
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
              onPress: retry,
              pending: inventory.result.waiting || commands.pending > 0,
            }}
          />
        </Box>
      );
    case 'unavailable':
      return <Empty title="Workspace unavailable" description={state.reason} />;
    case 'none':
      return (
        <Empty title={title} description="Select a worktree to continue." />
      );
    case 'selected':
      return children(state.workspace);
    default:
      return state satisfies never;
  }
}
