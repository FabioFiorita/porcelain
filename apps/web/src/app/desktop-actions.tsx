import { useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import {
  OpenProjectDialog,
  openProjectDialog,
} from '@/features/projects/index';
import { onDesktopAction } from '@/shared/adapters/desktop';
import type { Connection } from '@/shared/workspace/connection';

export function DesktopActions({
  connection,
  empty,
}: {
  connection: Connection;
  empty: boolean;
}) {
  const navigate = useNavigate();
  useEffect(
    () =>
      onDesktopAction((action) => {
        if (action === 'open-settings')
          void navigate({
            to: '/settings/$section',
            params: { section: 'appearance' },
          });
        else openProjectDialog.open(null);
      }),
    [navigate],
  );
  return (
    <OpenProjectDialog
      connection={connection}
      onOpened={(projectId, worktreeId) =>
        navigate({
          to: '/$projectId/$worktreeId',
          params: { projectId, worktreeId },
          replace: empty,
        })
      }
    />
  );
}
