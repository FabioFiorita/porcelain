import { useHotkey } from '@tanstack/react-hotkeys';
import { useQueryClient } from '@tanstack/react-query';
import { MoonIcon, SunIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { ConnectedWorkspace, type Connection } from './connected-workspace';
import { ConnectionForm } from './connection-form';

export function App() {
  const queryClient = useQueryClient();
  const [connection, setConnection] = useState<Connection | null>(null);
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
      <main className="mx-auto flex min-h-[70svh] max-w-6xl items-start px-6 py-10">
        {connection ? (
          <ConnectedWorkspace
            connection={connection}
            onDisconnect={() => setConnection(null)}
          />
        ) : (
          <ConnectionForm
            onConnect={(token, inventory) => {
              queryClient.setQueryData(
                ['inventory', inventory.environmentId],
                inventory,
              );
              setConnection({ token, environmentId: inventory.environmentId });
            }}
          />
        )}
      </main>
    </div>
  );
}
