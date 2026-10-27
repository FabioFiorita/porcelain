import { Cause } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ENVIRONMENT_NAME_MAX_LENGTH } from '@/config/limits';
import { submitForm } from '@/shared/lib/submit-form';
import { useRenameEnvironment } from '../commands/share';
import { connectionErrorMessage } from '@porcelain/client/access/rules';
import type { Environment } from '@porcelain/client/access/rules';
import { type Connection } from '@/shared/workspace/connection';

export function EnvironmentName({
  connection,
  environment,
  onDone,
}: {
  connection: Connection;
  environment: Environment;
  onDone: () => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [focus] = useState(
    () => (element: HTMLInputElement | null) => element?.focus(),
  );
  const [renaming, rename] = useRenameEnvironment(connection);
  const value = draft ?? (environment.custom ? environment.name : '');
  const name = value.trim();
  const unchanged = environment.custom
    ? name === environment.name
    : name === '';
  return (
    <form
      className="flex max-w-160 flex-col gap-2"
      onSubmit={(event) =>
        submitForm(event, async () =>
          rename(name === '' ? null : name).then(onDone),
        )
      }
    >
      <Field>
        <Label
          htmlFor="environment-name"
          className="text-xs text-muted-foreground"
        >
          Name of this computer
        </Label>
        <div className="flex gap-2">
          <Input
            ref={focus}
            id="environment-name"
            className="min-w-0 flex-1"
            onKeyDown={(event) => {
              if (event.key === 'Escape') onDone();
            }}
            placeholder={environment.custom ? 'Host name' : environment.name}
            maxLength={ENVIRONMENT_NAME_MAX_LENGTH}
            value={value}
            onChange={(event) => setDraft(event.target.value)}
          />
          <Button
            type="submit"
            variant="outline"
            className="rounded-md px-3.5 text-ui"
            disabled={unchanged || renaming.waiting}
          >
            {renaming.waiting ? 'Saving…' : 'Save'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="rounded-md px-3.5 text-ui"
            onClick={onDone}
          >
            Cancel
          </Button>
        </div>
        <FieldDescription className="text-xs">
          Paired devices show it so you know where they are connected. Leave it
          empty to use the host name.
        </FieldDescription>
      </Field>
      {AsyncResult.isFailure(renaming) && (
        <Alert variant="destructive">
          <AlertDescription>
            {connectionErrorMessage(Cause.squash(renaming.cause))}
          </AlertDescription>
        </Alert>
      )}
    </form>
  );
}
