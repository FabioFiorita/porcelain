import type { RemoteConnection } from '@porcelain/client/access';
import { selectedWorktreeInProject } from '@porcelain/client/projects/rules';
import { Navigate } from '@tanstack/react-router';
import { useConnectedContext } from '@/features/access/index';
import { useInventory } from '@/features/projects/index';
import type { WorkspaceSearch } from '@/shared/workspace/search';
import { ConnectedWorkspace } from './connected-workspace';
import { WorkspacePending } from './workspace-pending';

export function WorktreeRoute({
  projectId,
  worktreeId,
  search,
  remote,
  settled,
}: {
  projectId: string;
  worktreeId: string;
  search: WorkspaceSearch;
  remote?: RemoteConnection;
  settled: boolean;
}) {
  const { connection } = useConnectedContext(remote?.connection);
  const inventory = useInventory(connection);
  const selection = selectedWorktreeInProject(inventory, worktreeId);
  if (selection?.projectId !== projectId) {
    if (!settled) return <WorkspacePending />;
    return (
      <Navigate to="/" search={{ ...search, worktree: worktreeId }} replace />
    );
  }
  return (
    <ConnectedWorkspace
      review={{ selection, search, inventory }}
      {...(remote ? { remote } : {})}
    />
  );
}
