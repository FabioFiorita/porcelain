import { readInventory } from '@porcelain/client/inventory';
import { useState } from 'react';
import { Alert, AlertDescription } from './components/ui/alert';
import { Button } from './components/ui/button';
import { Field, FieldGroup, FieldLabel } from './components/ui/field';
import { Input } from './components/ui/input';
import type { BeginConnection } from './connection-form';

async function readCredentials() {
  const response = await fetch('/__porcelain/playground', {
    method: 'POST',
    headers: { 'x-porcelain-playground': '1' },
    cache: 'no-store',
    credentials: 'omit',
    redirect: 'error',
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error('Playground credentials are unavailable.');
  const value: unknown = await response.json();
  if (
    !value ||
    typeof value !== 'object' ||
    !('token' in value) ||
    typeof value.token !== 'string' ||
    !('tokenFile' in value) ||
    typeof value.tokenFile !== 'string'
  )
    throw new Error('Invalid playground credentials.');
  return { token: value.token, tokenFile: value.tokenFile };
}

export function PlaygroundPanel({
  connected,
  beginConnection,
}: {
  connected: boolean;
  beginConnection: BeginConnection;
}) {
  const [token, setToken] = useState('');
  const [tokenFile, setTokenFile] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  async function perform(action: 'reveal' | 'copy' | 'connect') {
    const complete = action === 'connect' ? beginConnection() : undefined;
    setPending(true);
    setMessage('');
    try {
      const credentials = await readCredentials();
      setTokenFile(credentials.tokenFile);
      if (action === 'reveal') setToken(credentials.token);
      if (action === 'copy') {
        await navigator.clipboard.writeText(credentials.token);
        setMessage('Token copied.');
      }
      if (action === 'connect') {
        const inventory = await readInventory({
          endpoint: '/api',
          token: credentials.token,
          fetch,
          signal: AbortSignal.timeout(15000),
        });
        setToken('');
        if (complete?.(credentials.token, inventory))
          setMessage('Connected to playground.');
      }
    } catch {
      setMessage(
        'Could not complete the action. Check that the playground is running and clipboard access is allowed when copying.',
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <section
      aria-label="Playground tools"
      className="flex h-full flex-col gap-4 overflow-auto bg-background p-4 text-foreground"
    >
      <h2 className="font-medium">Development playground</h2>
      <p className="text-sm text-muted-foreground">
        Disposable credentials for this run. Restart the playground to generate
        a fresh environment and token.
      </p>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="playground-token-file">Token file</FieldLabel>
          <Input
            id="playground-token-file"
            readOnly
            value={tokenFile}
            placeholder="Use an action to inspect this run"
          />
        </Field>
        {token && (
          <Field>
            <FieldLabel htmlFor="playground-token">Playground token</FieldLabel>
            <Input
              id="playground-token"
              readOnly
              autoComplete="off"
              value={token}
            />
          </Field>
        )}
      </FieldGroup>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => (token ? setToken('') : void perform('reveal'))}
        >
          {token ? 'Hide token' : 'Reveal token'}
        </Button>
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => void perform('copy')}
        >
          Copy token
        </Button>
        <Button
          disabled={pending || connected}
          onClick={() => void perform('connect')}
        >
          {connected ? 'Connected' : 'Connect to playground'}
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
