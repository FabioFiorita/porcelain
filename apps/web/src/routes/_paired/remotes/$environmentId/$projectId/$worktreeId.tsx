import { createFileRoute, Navigate } from '@tanstack/react-router';
import {
  useRemoteConnection,
  type RemoteConnection,
} from '@/features/access/index';
import {
  selectedWorktreeInProject,
  useInventory,
} from '@/features/projects/index';
import { ConnectedWorkspace } from '@/app/connected-workspace';
import { WorkspaceError } from '@/app/workspace-error';
import { WorkspacePending } from '@/app/workspace-pending';
import { desktopShell } from '@/shared/shell';
import {
  workspaceSearchSchema,
  type WorkspaceSearch,
} from '@/shared/workspace/search';

export const Route = createFileRoute(
  '/_paired/remotes/$environmentId/$projectId/$worktreeId',
)({
  validateSearch: workspaceSearchSchema,
  pendingComponent: WorkspacePending,
  errorComponent: WorkspaceError,
  component: RemoteWorktreeLayout,
});

function RemoteWorktreeLayout() {
  const { environmentId, projectId, worktreeId } = Route.useParams();
  const search = Route.useSearch();
  const remote = useRemoteConnection(environmentId);
  if (!desktopShell || !remote) return <Navigate to="/" replace />;
  return (
    <RemoteWorktree
      key={environmentId}
      remote={remote}
      projectId={projectId}
      worktreeId={worktreeId}
      search={search}
    />
  );
}

function RemoteWorktree({
  remote,
  projectId,
  worktreeId,
  search,
}: {
  remote: RemoteConnection;
  projectId: string;
  worktreeId: string;
  search: WorkspaceSearch;
}) {
  const inventory = useInventory(remote.connection);
  const selection = selectedWorktreeInProject(inventory, worktreeId);
  if (selection?.projectId !== projectId) return <Navigate to="/" replace />;
  return <ConnectedWorkspace review={{ selection, search }} remote={remote} />;
}
