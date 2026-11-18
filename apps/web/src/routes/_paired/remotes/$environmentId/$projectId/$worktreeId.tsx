import { Schema } from 'effect';
import {
  createFileRoute,
  Navigate,
  useRouterState,
} from '@tanstack/react-router';
import { useRemoteConnection, useRemoteStatus } from '@/features/access/index';
import { WorktreeRoute } from '@/app/worktree-route';
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
  validateSearch: Schema.decodeUnknownSync(workspaceSearchSchema),
  pendingComponent: WorkspacePending,
  errorComponent: WorkspaceError,
  component: RemoteWorktreeLayout,
});

type Shown = {
  remote: NonNullable<ReturnType<typeof useRemoteConnection>>;
  projectId: string;
  worktreeId: string;
  search: WorkspaceSearch;
  settled: boolean;
};

function RemoteWorktreeLayout() {
  const { environmentId, projectId, worktreeId } = Route.useParams();
  const search = Route.useSearch();
  const settled = useRouterState({
    select: (state) =>
      state.status === 'idle' &&
      state.location.pathname ===
        `/remotes/${environmentId}/${projectId}/${worktreeId}`,
  });
  const remote = useRemoteConnection(environmentId);
  if (!desktopShell || !remote) {
    if (!settled) return <WorkspacePending />;
    return (
      <Navigate to="/" search={{ ...search, worktree: worktreeId }} replace />
    );
  }
  return (
    <RemoteStatusGate
      key={environmentId}
      remote={remote}
      projectId={projectId}
      worktreeId={worktreeId}
      search={search}
      settled={settled}
    />
  );
}

function RemoteStatusGate(shown: Shown) {
  const status = useRemoteStatus(shown.remote.remote);
  if (status.kind === 'checking') return <WorkspacePending />;
  if (
    status.kind === 'online' ||
    (status.kind === 'reconnecting' &&
      shown.remote.connection.liveUpdates.state.value === 'reconnecting')
  )
    return <WorktreeRoute {...shown} />;
  return <ConnectedWorkspace remote={shown.remote} unavailable={status} />;
}
