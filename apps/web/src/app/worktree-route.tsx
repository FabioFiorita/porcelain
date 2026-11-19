import type { RemoteConnection } from '@porcelain/client/access';
import { selectedWorktreeInProject } from '@porcelain/client/projects/rules';
import { Navigate } from '@tanstack/react-router';
import { useAtomMount } from '@effect/atom-react';
import type { ComponentProps } from 'react';
import { Atom } from 'effect/reactivity';
import {
  rememberRemoteWorkspace,
  useConnectedContext,
} from '@/features/access/index';
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
  remoteStatus,
  showRemoteNotice,
  background,
}: {
  projectId: string;
  worktreeId: string;
  search: WorkspaceSearch;
  remote?: RemoteConnection;
  settled: boolean;
  remoteStatus?: ComponentProps<typeof ConnectedWorkspace>['remoteStatus'];
  showRemoteNotice?: boolean;
  background: boolean;
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
    <SelectedWorkspace
      review={{ selection, search, inventory }}
      {...(remote ? { remote } : {})}
      remoteStatus={remoteStatus}
      showRemoteNotice={showRemoteNotice}
      background={background}
    />
  );
}

const localWorkspace = Atom.make(undefined);

function SelectedWorkspace(props: ComponentProps<typeof ConnectedWorkspace>) {
  useAtomMount(
    props.remote
      ? rememberRemoteWorkspace(props.remote.remote.environmentId)
      : localWorkspace,
  );
  return <ConnectedWorkspace {...props} />;
}
