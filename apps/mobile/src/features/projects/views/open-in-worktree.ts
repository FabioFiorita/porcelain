import { useRouter } from 'expo-router';
import { useAtomRef } from '@effect/atom-react';
import { remoteConnectionState } from '../../../shared/application/store';
import { workspaceKey } from '../commands/workspace-connection';
import type { WorkspacePickerProps } from './workspace-picker-props';

export function useOpenInWorktree(
  onWorktree: WorkspacePickerProps['onWorktree'],
) {
  const router = useRouter();
  const remotes = useAtomRef(remoteConnectionState);
  return (
    target: {
      readonly environmentId: string;
      readonly projectId: string;
      readonly worktreeId: string;
    },
    destination:
      | '/review'
      | '/files'
      | '/history'
      | ((workspace: string) => void),
  ) => {
    const remote = remotes.find(
      (candidate) => candidate.remote.environmentId === target.environmentId,
    )?.remote;
    if (!remote) return;
    const workspace = workspaceKey(remote, target);
    onWorktree(target.environmentId, target.projectId, target.worktreeId, () =>
      typeof destination === 'function'
        ? destination(workspace)
        : router.push({ pathname: destination, params: { workspace } }),
    );
  };
}
