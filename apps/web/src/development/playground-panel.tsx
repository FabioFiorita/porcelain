import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useConnection } from '../query/connection';

import { usePlaygroundPairing } from '../query/playground';

export function PlaygroundPanel() {
  const { connected } = useConnection();
  const pairing = usePlaygroundPairing();
  const [message, setMessage] = useState('');

  return (
    <section
      aria-label="Playground tools"
      className="flex h-full flex-col gap-4 overflow-auto bg-background p-4 text-foreground"
    >
      <h2 className="font-medium">Development playground</h2>
      <p className="text-sm text-muted-foreground">
        This browser pairs with a link of its own, minted for this window and
        good once. Nothing reusable is shown here, and restarting the playground
        discards every device it paired.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={pairing.isPending || connected}
          onClick={async () => {
            setMessage('');
            try {
              if (await pairing.submit()) setMessage('Paired with playground.');
            } catch {
              setMessage(
                'Could not pair. Check that the playground server is running.',
              );
            }
          }}
        >
          {connected ? 'Paired' : 'Pair this browser'}
        </Button>
      </div>
      {message && (
        <Alert>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
    </section>
  );
}
