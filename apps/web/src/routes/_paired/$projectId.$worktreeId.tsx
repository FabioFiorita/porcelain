import { createFileRoute, Navigate } from '@tanstack/react-router';
import { useAccessStore } from '@/features/access/index';
import {
  selectedWorktreeInProject,
  useInventory,
} from '@/features/projects/index';
import { ConnectedWorkspace } from '@/app/connected-workspace';
import { WorkspaceError } from '@/app/workspace-error';
import { WorkspacePending } from '@/app/workspace-pending';
import { workspaceSearchSchema } from '@/shared/workspace/search';

export const Route = createFileRoute('/_paired/$projectId/$worktreeId')({
  validateSearch: workspaceSearchSchema,
  pendingComponent: WorkspacePending,
  errorComponent: WorkspaceError,
  component: WorktreeWorkspace,
});

function WorktreeWorkspace() {
  const { projectId, worktreeId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const connection = useAccessStore((state) => state.connection);
  const inventory = useInventory(connection);
  const selection = selectedWorktreeInProject(inventory, worktreeId);
  if (selection?.projectId !== projectId)
    return (
      <Navigate to="/" search={{ ...search, worktree: worktreeId }} replace />
    );
  return (
    <ConnectedWorkspace
      review={{
        selection,
        search,
        onSearch: (update, options) =>
          void navigate({
            search: (previous) => ({ ...previous, ...update }),
            ...options,
          }),
      }}
    />
  );
}
