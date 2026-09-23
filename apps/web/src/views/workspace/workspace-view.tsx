import { Suspense } from 'react';
import { useConnection } from '../../query/connection';
import { DisconnectedPage } from '../connection/disconnected-page';
import { NotPaired } from '../connection/not-paired';
import { ConnectedWorkspace } from './connected-workspace';
import { WorkspacePending } from './workspace-pending';

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
