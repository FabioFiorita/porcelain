import { useHotkey } from '@tanstack/react-hotkeys';
import { MoonIcon, SunIcon } from 'lucide-react';
import { lazy, Suspense, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useConnection } from '../../query/connection';
import { ConnectionForm } from '../connection/connection-form';
import { ConnectedWorkspace } from './connected-workspace';
import { WorkspacePending } from './workspace-pending';

const MockTools =
  import.meta.env.VITE_API_MODE === 'mock'
    ? lazy(() =>
        import('../../development/mock-tools').then((module) => ({
          default: module.MockTools,
        })),
      )
    : null;

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
  const [dark, setDark] = useState(false);
  useHotkey('Alt+Shift+D', () => setDark((current) => !current));
  return (
    <div
      className={cn('min-h-svh bg-background text-foreground', dark && 'dark')}
    >
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <h1 className="font-medium">Porcelain</h1>
        <Button
          aria-keyshortcuts="Alt+Shift+D"
          title="Toggle theme (Alt+Shift+D)"
          variant="ghost"
          size="icon"
          aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
          onClick={() => setDark((current) => !current)}
        >
          {dark ? <SunIcon /> : <MoonIcon />}
        </Button>
      </header>
      <Separator />
      {MockTools ? (
        <Suspense fallback={null}>
          <MockTools />
        </Suspense>
      ) : null}
      <main className="mx-auto flex min-h-[70svh] max-w-6xl flex-col items-start gap-6 px-6 py-10">
        {PlaygroundAutoConnect && (
          <Suspense fallback={null}>
            <PlaygroundAutoConnect />
          </Suspense>
        )}
        <Suspense fallback={<WorkspacePending />}>
          {connected ? <ConnectedWorkspace /> : <ConnectionForm />}
        </Suspense>
      </main>
      {Devtools && (
        <Suspense fallback={null}>
          <Devtools />
        </Suspense>
      )}
    </div>
  );
}
