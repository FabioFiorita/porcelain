import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ENVIRONMENT_NAME_MAX_LENGTH } from '@/config/limits';
import { submitForm } from '@/shared/lib/submit-form';
import { useRenameEnvironment } from '../commands/share';
import { connectionErrorMessage } from '../rules/connection-error-message';
import type { Environment, ShareConnection } from '../rules/share';

export function EnvironmentName({
  connection,
  environment,
}: {
  connection: ShareConnection;
  environment: Environment;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const rename = useRenameEnvironment(connection);
  const value = draft ?? (environment.custom ? environment.name : '');
  const name = value.trim();
  const unchanged = environment.custom
    ? name === environment.name
    : name === '';
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) =>
        submitForm(event, async () => rename.submit(name === '' ? null : name))
      }
    >
      <Field>
        <Label htmlFor="environment-name">Name of this computer</Label>
        <div className="flex gap-2">
          <Input
            id="environment-name"
            className="min-w-0 flex-1"
            placeholder={environment.custom ? 'Host name' : environment.name}
            maxLength={ENVIRONMENT_NAME_MAX_LENGTH}
            value={value}
            onChange={(event) => setDraft(event.target.value)}
          />
          <Button
            type="submit"
            variant="outline"
            disabled={unchanged || rename.isPending}
          >
            {rename.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
        <FieldDescription>
          Paired devices show it so you know where they are connected. Leave it
          empty to use the host name.
        </FieldDescription>
      </Field>
      {rename.error && (
        <Alert variant="destructive">
          <AlertDescription>
            {connectionErrorMessage(rename.error)}
          </AlertDescription>
        </Alert>
      )}
    </form>
  );
}
