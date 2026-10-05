import {
  firstWaitingWorktree,
  selectedWorktreeInProject,
} from '@porcelain/client/projects/rules';
import {
  createFileRoute,
  Navigate,
  useRouterState,
} from '@tanstack/react-router';
import { z } from 'zod';
import { useConnectedContext } from '@/features/access/index';
import { useInventory } from '@/features/projects/index';
import { ConnectedWorkspace } from '@/app/connected-workspace';
import { WorkspaceError } from '@/app/workspace-error';
import { WorkspacePending } from '@/app/workspace-pending';
import { workspaceSearchSchema } from '@/shared/workspace/search';

export const Route = createFileRoute('/_paired/')({
  validateSearch: workspaceSearchSchema.extend({
    worktree: z.string().optional().catch(undefined),
  }),
  pendingComponent: WorkspacePending,
  errorComponent: WorkspaceError,
  component: WorkspaceIndex,
});

function WorkspaceIndex() {
  const { worktree, ...search } = Route.useSearch();
  const settled = useRouterState({
    select: (state) =>
      state.status === 'idle' && state.location.pathname === '/',
  });
  const { connection } = useConnectedContext();
  const inventory = useInventory(connection);
  const target =
    worktree === undefined
      ? selectedWorktreeInProject(
          inventory,
          firstWaitingWorktree(inventory)?.id,
        )
      : selectedWorktreeInProject(inventory, worktree);
  if (target && settled)
    return (
      <Navigate
        to="/$projectId/$worktreeId"
        params={{ projectId: target.projectId, worktreeId: target.worktree.id }}
        search={worktree === undefined ? {} : search}
        replace
      />
    );
  return <ConnectedWorkspace missing={worktree !== undefined && settled} />;
}
