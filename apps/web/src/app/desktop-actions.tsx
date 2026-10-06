import { linkOptions, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { toast } from '@/components/ui/toast';
import { connectionErrorMessage } from '@porcelain/client/access/rules';
import { useRemoteConnections } from '@/features/access/index';
import {
  OpenProjectDialog,
  openProjectDialog,
  useNativeProjectPicker,
  type WorktreeTarget,
} from '@/features/projects/index';
import { onDesktopAction } from '@/shared/adapters/desktop';
import type { Connection } from '@/shared/workspace/connection';

export function worktreeLocation(target: WorktreeTarget) {
  const params = { projectId: target.projectId, worktreeId: target.worktreeId };
  return target.remote === null
    ? linkOptions({ to: '/$projectId/$worktreeId', params })
    : linkOptions({
        to: '/remotes/$environmentId/$projectId/$worktreeId',
        params: { environmentId: target.remote, ...params },
      });
}

export function useOpenProjectOnThisComputer(
  connection: Connection,
  openWorktree: (target: WorktreeTarget) => Promise<void>,
) {
  const pick = useNativeProjectPicker(connection, openWorktree, (error) =>
    toast.add({
      title: 'Could not open the project',
      description: connectionErrorMessage(error),
      type: 'error',
    }),
  );
  return () =>
    pick ? pick() : openProjectDialog.openWithPayload({ remote: null });
}

export function DesktopActions({
  connection,
  empty,
}: {
  connection: Connection;
  empty: boolean;
}) {
  const navigate = useNavigate();
  const remotes = useRemoteConnections();
  const openWorktree = (target: WorktreeTarget) =>
    navigate({ ...worktreeLocation(target), replace: empty });
  const openHere = useOpenProjectOnThisComputer(connection, openWorktree);
  useEffect(
    () =>
      onDesktopAction((action) => {
        if (action === 'open-settings')
          void navigate({
            to: '/settings/$section',
            params: { section: 'appearance' },
          });
        else openHere();
      }),
    [navigate, openHere],
  );
  return (
    <OpenProjectDialog
      connection={connection}
      remotes={remotes}
      onOpened={openWorktree}
    />
  );
}
