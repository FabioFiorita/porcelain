import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useConnection } from '../query/connection';

import { usePlaygroundAction } from '../query/playground';

export function PlaygroundPanel() {
  const { connected } = useConnection();
  const actionMutation = usePlaygroundAction();
  const pending = actionMutation.isPending;
  const [token, setToken] = useState('');
  const [tokenFile, setTokenFile] = useState('');
  const [message, setMessage] = useState('');
  async function perform(action: 'reveal' | 'copy' | 'connect') {
    setMessage('');
    try {
      const result = await actionMutation.submit(action);
      setTokenFile(result.tokenFile);
      if (action === 'reveal') setToken(result.token);
      if (action === 'copy') setMessage('Token copied.');
      if (action === 'connect') {
        setToken('');
        if (result.connected) setMessage('Connected to playground.');
      }
    } catch {
      setMessage(
        'Could not complete the action. Check that the playground is running and clipboard access is allowed when copying.',
      );
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
