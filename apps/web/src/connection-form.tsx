import { readInventory } from '@porcelain/client/inventory';
import type { InventoryResponse } from '@porcelain/contracts/inventory';
import { useForm } from '@tanstack/react-form';
import { useState } from 'react';
import { Alert, AlertDescription } from './components/ui/alert';
import { Button } from './components/ui/button';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from './components/ui/field';
import { Input } from './components/ui/input';

export type BeginConnection = () => (
  token: string,
  inventory: InventoryResponse,
) => boolean;

export function ConnectionForm({
  beginConnection,
}: {
  beginConnection: BeginConnection;
}) {
  const [error, setError] = useState('');
  const form = useForm({
    defaultValues: { token: '' },
    onSubmit: async ({ value, formApi }) => {
      const complete = beginConnection();
      setError('');
      try {
        const token = value.token.trim();
        const inventory = await readInventory({
          endpoint: '/api',
          token,
          fetch,
          signal: AbortSignal.timeout(15_000),
        });
        formApi.reset();
        complete(token, inventory);
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Could not connect.');
      }
    },
  });
  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">No environment connected</h2>
        <p className="text-sm text-muted-foreground">
          Connect to see your projects and worktrees.
        </p>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <FieldGroup>
          <form.Field name="token">
            {(field) => (
              <Field>
                <FieldLabel htmlFor="access-token">Access token</FieldLabel>
                <Input
                  id="access-token"
                  name={field.name}
                  type="password"
                  autoComplete="off"
                  required
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
                <FieldDescription>
                  Use the token for the configured environment. It is kept only
                  for this session.
                </FieldDescription>
              </Field>
            )}
          </form.Field>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <form.Subscribe
            selector={(state) =>
              [state.isSubmitting, state.values.token] as const
            }
          >
            {([pending, token]) => (
              <Button type="submit" disabled={pending || !token.trim()}>
                {pending ? 'Connecting…' : 'Connect'}
              </Button>
            )}
          </form.Subscribe>
        </FieldGroup>
      </form>
    </section>
  );
}
