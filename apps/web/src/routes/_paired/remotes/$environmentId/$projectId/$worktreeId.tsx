import { selectedWorktreeInProject } from '@porcelain/client/projects/rules';
import { createFileRoute, Navigate } from '@tanstack/react-router';
import {
  useRemoteConnection,
  useRemoteStatus,
  type RemoteConnection,
} from '@/features/access/index';
import { useInventory } from '@/features/projects/index';
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

type Shown = {
  remote: RemoteConnection;
  projectId: string;
  worktreeId: string;
  search: WorkspaceSearch;
};

function RemoteWorktreeLayout() {
  const { environmentId, projectId, worktreeId } = Route.useParams();
  const search = Route.useSearch();
  const remote = useRemoteConnection(environmentId);
  if (!desktopShell || !remote)
    return (
      <Navigate to="/" search={{ ...search, worktree: worktreeId }} replace />
    );
  return (
    <RemoteStatusGate
      key={environmentId}
      remote={remote}
      projectId={projectId}
      worktreeId={worktreeId}
      search={search}
    />
  );
}

function RemoteStatusGate(shown: Shown) {
  const status = useRemoteStatus(shown.remote.remote);
  if (status.kind === 'checking') return <WorkspacePending />;
  if (status.kind !== 'online')
    return <ConnectedWorkspace remote={shown.remote} unavailable={status} />;
  return <RemoteWorktree {...shown} />;
}

function RemoteWorktree({ remote, projectId, worktreeId, search }: Shown) {
  const inventory = useInventory(remote.connection);
  const selection = selectedWorktreeInProject(inventory, worktreeId);
  if (selection?.projectId !== projectId)
    return (
      <Navigate to="/" search={{ ...search, worktree: worktreeId }} replace />
    );
  return (
    <ConnectedWorkspace
      review={{ selection, search, inventory }}
      remote={remote}
    />
  );
}
