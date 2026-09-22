import { lazy, Suspense } from 'react';
import { useConnection } from '../../query/connection';
import { DisconnectedPage } from '../connection/disconnected-page';
import { NotPaired } from '../connection/not-paired';
import { ConnectedWorkspace } from './connected-workspace';
import { WorkspacePending } from './workspace-pending';

const Devtools = import.meta.env.DEV
  ? lazy(() =>
      import('../../development/devtools').then((module) => ({
        default: module.Devtools,
      })),
    )
  : null;

const PlaygroundAutoConnect =
  import.meta.env.DEV && import.meta.env.PORCELAIN_PLAYGROUND_AUTO_CONNECT
    ? lazy(() =>
        import('../../development/playground-auto-connect').then((module) => ({
          default: module.PlaygroundAutoConnect,
        })),
      )
    : null;

export function WorkspaceView() {
  const { connected, restoring } = useConnection();
  const body = (
    <>
      {PlaygroundAutoConnect && (
        <Suspense fallback={null}>
          <PlaygroundAutoConnect />
        </Suspense>
      )}
      <Suspense fallback={<WorkspacePending />}>
        {connected ? (
          <ConnectedWorkspace />
        ) : restoring ? (
          <WorkspacePending />
        ) : (
          <NotPaired />
        )}
      </Suspense>
    </>
  );
  return (
    <>
      {connected || restoring ? (
        <div>{body}</div>
      ) : (
        <DisconnectedPage>{body}</DisconnectedPage>
      )}
      {Devtools && (
        <Suspense fallback={null}>
          <Devtools />
        </Suspense>
      )}
    </>
  );
}
