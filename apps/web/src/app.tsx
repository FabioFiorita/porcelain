import type { InventoryResponse } from '@porcelain/contracts/inventory';
import { useHotkey } from '@tanstack/react-hotkeys';
import { useQueryClient } from '@tanstack/react-query';
import { MoonIcon, SunIcon } from 'lucide-react';
import { lazy, Suspense, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { ConnectedWorkspace, type Connection } from './connected-workspace';
import { ConnectionForm } from './connection-form';

const Devtools = import.meta.env.DEV
  ? lazy(() =>
      import('./devtools').then((module) => ({ default: module.Devtools })),
    )
  : null;

export function App() {
  const queryClient = useQueryClient();
  const [connection, setConnection] = useState<Connection | null>(null);
  const connectionGeneration = useRef(0);
  const [dark, setDark] = useState(false);
  useHotkey('Alt+Shift+D', () => setDark((current) => !current));
  function beginConnection() {
    const generation = connectionGeneration.current;
    return (token: string, inventory: InventoryResponse) => {
      if (generation !== connectionGeneration.current) return false;
      connectionGeneration.current += 1;
      queryClient.setQueryData(
        ['inventory', inventory.environmentId],
        inventory,
      );
      setConnection({ token, environmentId: inventory.environmentId });
      return true;
    };
  }
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
      <main className="mx-auto flex min-h-[70svh] max-w-6xl items-start px-6 py-10">
        {connection ? (
          <ConnectedWorkspace
            connection={connection}
            onDisconnect={() => {
              connectionGeneration.current += 1;
              setConnection(null);
            }}
          />
        ) : (
          <ConnectionForm beginConnection={beginConnection} />
        )}
      </main>
      {Devtools && (
        <Suspense fallback={null}>
          <Devtools
            connected={connection !== null}
            beginConnection={beginConnection}
          />
        </Suspense>
      )}
    </div>
  );
}
