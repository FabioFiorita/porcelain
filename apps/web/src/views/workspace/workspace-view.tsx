import { lazy, Suspense } from 'react';
import { cn } from '@/lib/utils';
import { useConnection } from '../../query/connection';
import { ConnectionForm } from '../connection/connection-form';
import { ConnectedWorkspace } from './connected-workspace';
import { ThemeProvider, ThemeToggle } from './theme';
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
  const { connected } = useConnection();
  return (
    <ThemeProvider>
      {!connected && (
        <div className="absolute right-4 top-3 flex items-center gap-3">
          <h1 className="font-medium">Porcelain</h1>
          <ThemeToggle />
        </div>
      )}

      <div
        role={connected ? undefined : 'main'}
        className={cn(
          !connected &&
            'mx-auto flex min-h-svh max-w-6xl flex-col items-start gap-6 px-6 py-24',
        )}
      >
        {PlaygroundAutoConnect && (
          <Suspense fallback={null}>
            <PlaygroundAutoConnect />
          </Suspense>
        )}
        <Suspense fallback={<WorkspacePending />}>
          {connected ? <ConnectedWorkspace /> : <ConnectionForm />}
        </Suspense>
      </div>
      {Devtools && (
        <Suspense fallback={null}>
          <Devtools />
        </Suspense>
      )}
    </ThemeProvider>
  );
}
