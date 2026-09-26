import { lazy, Suspense } from 'react';
import {
  DisconnectedPage,
  NotPaired,
  useConnection,
} from '@/features/access/index';
import { ReviewShell } from '@/features/review/index';
import { WorkspacePending } from '@/app/views/workspace-pending';

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
        <ReviewShell>
          <ConnectedWorkspace />
        </ReviewShell>
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
