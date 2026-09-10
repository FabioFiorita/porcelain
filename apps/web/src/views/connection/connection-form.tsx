import { useForm } from '@tanstack/react-form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { submitForm } from '../../lib/submit-form';
import { connectionErrorMessage, useConnect } from '../../query/connection';

export function ConnectionForm() {
  const connect = useConnect();
  const form = useForm({
    defaultValues: { token: '' },
    onSubmit: async ({ value, formApi }) => {
      await connect.submit(value.token);
      formApi.reset();
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
      <form onSubmit={(event) => submitForm(event, form.handleSubmit)}>
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
                  Use the token for the configured environment. This browser
                  stays connected until you disconnect or the session expires.
                </FieldDescription>
              </Field>
            )}
          </form.Field>
          {connect.error && (
            <Alert variant="destructive">
              <AlertDescription>
                {connectionErrorMessage(connect.error)}
              </AlertDescription>
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
