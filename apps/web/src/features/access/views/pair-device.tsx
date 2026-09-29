import { CopyIcon, LinkIcon } from 'lucide-react';
import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { Spinner } from '@/components/ui/spinner';
import { PAIRING_LABEL_MAX_LENGTH } from '@/config/limits';
import { copyText } from '@/shared/workspace/copy';
import { submitForm } from '@/shared/lib/submit-form';
import { useIssuePairing } from '../commands/share';
import { connectionErrorMessage } from '../rules/connection-error-message';
import {
  linkAddresses,
  pairingAddresses,
  remoteRouteTitles,
  type RemoteAccess,
  type ShareConnection,
} from '../rules/share';
import { PairingQr } from './pairing-qr';

export function PairDevice({
  connection,
  remote,
}: {
  connection: ShareConnection;
  remote: RemoteAccess;
}) {
  const addresses = pairingAddresses(remote);
  const [label, setLabel] = useState('');
  const [chosen, setChosen] = useState<string | null>(null);
  const issue = useIssuePairing(connection);
  const address =
    addresses.find(({ url }) => url === chosen)?.url ?? addresses[0]?.url;
  if (address === undefined)
    return (
      <p className="text-xs text-muted-foreground">
        Turn on a way in above to pair a phone or another computer.
      </p>
    );
  return (
    <div className="flex flex-col gap-3">
      <form
        className="flex flex-col gap-2 sm:flex-row sm:items-end"
        onSubmit={(event) =>
          submitForm(event, async () =>
            issue.submit({
              label: label.trim(),
              addresses: linkAddresses(address, addresses),
            }),
          )
        }
      >
        <Field className="min-w-0 flex-1">
          <Label htmlFor="pairing-label">Device name</Label>
          <Input
            id="pairing-label"
            placeholder="My phone"
            maxLength={PAIRING_LABEL_MAX_LENGTH}
            value={label}
            onChange={(event) => setLabel(event.target.value)}
          />
        </Field>
        {addresses.length > 1 && (
          <Field className="min-w-0 sm:w-56">
            <Label htmlFor="pairing-address">Opens through</Label>
            <NativeSelect
              id="pairing-address"
              className="w-full"
              value={address}
              onChange={(event) => setChosen(event.target.value)}
            >
              {addresses.map(({ route, url }) => (
                <NativeSelectOption key={url} value={url}>
                  {`${remoteRouteTitles[route]} · ${url}`}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
        )}
        <Button
          type="submit"
          className="shrink-0"
          disabled={issue.isPending || label.trim() === ''}
        >
          {issue.isPending ? <Spinner /> : <LinkIcon />}
          Create pairing link
        </Button>
      </form>
      {issue.error && (
        <Alert variant="destructive">
          <AlertDescription>
            {connectionErrorMessage(issue.error)}
          </AlertDescription>
        </Alert>
      )}
      {issue.issued && (
        <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3 sm:flex-row sm:items-start">
          <PairingQr link={issue.issued.link} />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <p className="text-sm font-medium">Scan on {issue.issued.label}</p>
            <p
              aria-label="Pairing link"
              className="font-mono text-xs break-all text-muted-foreground"
            >
              {issue.issued.link}
            </p>
            <p className="text-xs text-muted-foreground">
              Works once, until{' '}
              {new Date(issue.issued.expiresAt).toLocaleTimeString()}.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => copyText(issue.issued?.link ?? '', 'pairing link')}
            >
              <CopyIcon />
              Copy link
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
