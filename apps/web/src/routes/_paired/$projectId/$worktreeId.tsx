import { Schema } from 'effect';
import { selectedWorktreeInProject } from '@porcelain/client/projects/rules';
import { createFileRoute, Navigate } from '@tanstack/react-router';
import { useConnectedContext } from '@/features/access/index';
import { useInventory } from '@/features/projects/index';
import { ConnectedWorkspace } from '@/app/connected-workspace';
import { WorkspaceError } from '@/app/workspace-error';
import { WorkspacePending } from '@/app/workspace-pending';
import { workspaceSearchSchema } from '@/shared/workspace/search';

export const Route = createFileRoute('/_paired/$projectId/$worktreeId')({
  validateSearch: Schema.decodeUnknownSync(workspaceSearchSchema),
  pendingComponent: WorkspacePending,
  errorComponent: WorkspaceError,
  component: WorktreeLayout,
});

function WorktreeLayout() {
  const { projectId, worktreeId } = Route.useParams();
  const search = Route.useSearch();
  const { connection } = useConnectedContext();
  const inventory = useInventory(connection);
  const selection = selectedWorktreeInProject(inventory, worktreeId);
  if (selection?.projectId !== projectId)
    return (
      <Navigate to="/" search={{ ...search, worktree: worktreeId }} replace />
    );
  return <ConnectedWorkspace review={{ selection, search, inventory }} />;
}
