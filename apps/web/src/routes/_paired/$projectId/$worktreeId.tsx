import { Schema } from 'effect';
import { createFileRoute, useRouterState } from '@tanstack/react-router';
import { WorktreeRoute } from '@/app/worktree-route';
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
  const params = Route.useParams();
  const search = Route.useSearch();
  const settled = useRouterState({
    select: (state) =>
      state.status === 'idle' &&
      state.location.pathname === `/${params.projectId}/${params.worktreeId}`,
  });
  return <WorktreeRoute {...params} search={search} settled={settled} />;
}
