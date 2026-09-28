import {
  createFileRoute,
  Navigate,
  useRouterState,
} from '@tanstack/react-router';
import { z } from 'zod';
import { useAccessStore } from '@/features/access/index';
import {
  firstWaitingWorktree,
  selectedWorktreeInProject,
  useInventory,
} from '@/features/projects/index';
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
  const connection = useAccessStore((state) => state.connection);
  const inventory = useInventory(connection);
  const requested = selectedWorktreeInProject(inventory, worktree);
  const target =
    requested ??
    selectedWorktreeInProject(inventory, firstWaitingWorktree(inventory)?.id);
  if (target && settled)
    return (
      <Navigate
        to="/$projectId/$worktreeId"
        params={{ projectId: target.projectId, worktreeId: target.worktree.id }}
        search={requested ? search : {}}
        replace
      />
    );
  if (worktree !== undefined && settled) return <Navigate to="/" replace />;
  return <ConnectedWorkspace />;
}
