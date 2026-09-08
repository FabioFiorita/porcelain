import { readInventory } from '@porcelain/client/inventory';
import { useEffect, useState } from 'react';
import { Alert, AlertDescription } from './components/ui/alert';
import type { BeginConnection } from './connection-form';
import { readPlaygroundCredentials } from './playground-credentials';

export function PlaygroundAutoConnect({
  beginConnection,
  connected,
}: {
  beginConnection: () => ReturnType<BeginConnection> | null;
  connected: boolean;
}) {
  const [failed, setFailed] = useState(false);
  // Startup login is not cached/retried. Cleanup aborts it, and the error update
  // below checks cancellation before touching state; completion also guards stale sessions.
  // react-doctor-disable-next-line react-doctor/no-set-state-after-await-in-effect
  useEffect(() => {
    const complete = beginConnection();
    if (!complete) return;
    const controller = new AbortController();
    const signal = AbortSignal.any([
      controller.signal,
      AbortSignal.timeout(15000),
    ]);
    const connect = async () => {
      try {
        const { token } = await readPlaygroundCredentials(signal);
        const inventory = await readInventory({
          endpoint: '/api',
          token,
          fetch,
          signal,
        });
        signal.throwIfAborted();
        complete(token, inventory);
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      }
    };
    void connect();
    return () => controller.abort();
  }, [beginConnection]);
  return failed && !connected ? (
    <Alert>
      <AlertDescription>
        Automatic playground connection failed. Connect manually or retry from
        Playground Devtools.
      </AlertDescription>
    </Alert>
  ) : null;
}
