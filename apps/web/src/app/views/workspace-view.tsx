import { lazy, Suspense } from 'react';
import {
  DisconnectedPage,
  NotPaired,
  useConnection,
} from '@/features/access/index';
import { WorkspacePending } from '@/app/workspace-pending';

const ConnectedWorkspace = lazy(() =>
  import('./connected-workspace').then(({ ConnectedWorkspace }) => ({
    default: ConnectedWorkspace,
  })),
);

export function WorkspaceView() {
  const { connected, restoring } = useConnection();
  const body = (
    <Suspense fallback={<WorkspacePending />}>
      {connected ? (
        <ConnectedWorkspace />
      ) : restoring ? (
        <WorkspacePending />
      ) : (
        <NotPaired />
      )}
    </Suspense>
  );
  return connected || restoring ? (
    <div>{body}</div>
  ) : (
    <DisconnectedPage>{body}</DisconnectedPage>
  );
}
