import { Cause } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { CopyIcon, LinkIcon } from 'lucide-react';
import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
  SelectItem,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { PAIRING_LABEL_MAX_LENGTH } from '@/config/limits';
import { copyText } from '@/shared/workspace/copy';
import { submitForm } from '@/shared/lib/submit-form';
import { useIssuePairing } from '../commands/share';
import { usePairedAccess } from '../queries/share';
import { connectionErrorMessage } from '@porcelain/client/access/rules';
import {
  pairingAddresses,
  remoteRouteTitles,
  type RemoteAccess,
} from '@porcelain/client/access/rules';
import { PairingQr } from './pairing-qr';
import { type Connection } from '@/shared/workspace/connection';

export function PairDevice({
  connection,
  remote,
  disabled = false,
}: {
  connection: Connection;
  remote: RemoteAccess;
  disabled?: boolean;
}) {
  const addresses = pairingAddresses(remote);
  const [label, setLabel] = useState('');
  const [chosen, setChosen] = useState<string | null>(null);
  const [trusted, setTrusted] = useState(true);
  const [management, setManagement] = useState(true);
  const [issue, createPairing] = useIssuePairing(connection);
  const access = usePairedAccess(connection);
  const issued =
    AsyncResult.isSuccess(issue) &&
    AsyncResult.isSuccess(access) &&
    access.value?.grants.some((grant) => grant.id === issue.value?.id) === true
      ? issue.value
      : null;
  const target = addresses.find(({ url }) => url === chosen) ?? addresses[0];
  const issuedRoute =
    issued && addresses.find(({ url }) => url === issued.address)?.route;
  if (target === undefined)
    return (
      <p className="text-xs text-muted-foreground">
        Turn on a way in above to pair a device.
      </p>
    );
  return (
    <div className="flex flex-col gap-3">
      <form
        className="flex flex-col gap-2"
        onSubmit={(event) =>
          submitForm(event, async () =>
            createPairing({
              label: label.trim(),
              addresses: [target.url],
              trusted,
              canManageSharing: management,
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
          <Field className="min-w-0">
            <Label htmlFor="pairing-address">Opens through</Label>
            <Select
              items={addresses.map(({ route, url }) => ({
                value: url,
                label: `${remoteRouteTitles[route]} · ${url}`,
              }))}
              disabled={disabled}
              value={target.url}
              onValueChange={(value) => {
                if (value) setChosen(value);
              }}
            >
              <SelectTrigger
                id="pairing-address"
                aria-describedby="pairing-address-url"
                className="w-full"
              >
                <SelectValue>{remoteRouteTitles[target.route]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {addresses.map(({ route, url }) => (
                  <SelectItem key={url} value={url}>
                    <span className="mr-4 min-w-0 whitespace-normal [overflow-wrap:anywhere]">
                      {`${remoteRouteTitles[route]} · ${url}`}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p
              id="pairing-address-url"
              className="text-xs text-muted-foreground [overflow-wrap:anywhere]"
            >
              {target.url}
            </p>
          </Field>
        )}
        <Button
          type="submit"
          size="sm"
          className="shrink-0"
          disabled={disabled || issue.waiting || label.trim() === ''}
        >
          {issue.waiting ? <Spinner /> : <LinkIcon />}
          Create pairing link
        </Button>
      </form>
      <Field orientation="horizontal">
        <Switch
          id="pairing-management"
          checked={management}
          disabled={disabled}
          onCheckedChange={setManagement}
        />
        <Label htmlFor="pairing-management">Can manage sharing</Label>
      </Field>
      <Field orientation="horizontal">
        <Switch
          id="pairing-trusted"
          checked={trusted}
          disabled={disabled}
          onCheckedChange={setTrusted}
        />
        <Label htmlFor="pairing-trusted">
          <span className="sr-only">
            The paired device can update Porcelain
          </span>
          <span aria-hidden>Can update Porcelain</span>
        </Label>
      </Field>
      <p className="text-xs leading-4.25 text-muted-foreground">
        Uses {remoteRouteTitles[target.route]}. Pair again to add another way
        in.
      </p>
      {AsyncResult.isFailure(issue) && (
        <Alert variant="destructive">
          <AlertDescription>
            {connectionErrorMessage(Cause.squash(issue.cause))}
          </AlertDescription>
        </Alert>
      )}
      {issued && (
        <div className="flex flex-col gap-2.5 border-t pt-2.5">
          <div className="flex flex-wrap gap-2.5">
            <div className="shrink-0 rounded-lg bg-white p-1 inset-ring inset-ring-border">
              <PairingQr link={issued.link} />
            </div>
            <div className="flex min-w-0 flex-1 basis-20 flex-col gap-1 pt-0.5">
              <p className="text-ui leading-4.5 font-medium">
                Scan on {issued.label}
              </p>
              <p className="text-xs leading-4.25 text-muted-foreground">
                Works once, until{' '}
                <span className="tabular-nums">
                  {new Date(issued.expiresAt).toLocaleTimeString()}
                </span>
                {issuedRoute && <>, through {remoteRouteTitles[issuedRoute]}</>}
                .
              </p>
            </div>
          </div>
          <p
            aria-label="Pairing link"
            className="font-mono text-2xs leading-4 break-all text-muted-foreground"
          >
            {issued.link}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => copyText(issued?.link ?? '', 'pairing link')}
          >
            <CopyIcon />
            Copy link
          </Button>
        </div>
      )}
    </div>
  );
}
