import { Cause } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { CopyIcon, LinkIcon } from 'lucide-react';
import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Item, ItemContent, ItemMedia, ItemTitle } from '@/components/ui/item';
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
}: {
  connection: Connection;
  remote: RemoteAccess;
}) {
  const addresses = pairingAddresses(remote);
  const [label, setLabel] = useState('');
  const [chosen, setChosen] = useState<string | null>(null);
  const [trusted, setTrusted] = useState(false);
  const [issue, createPairing] = useIssuePairing(connection);
  const issued = AsyncResult.isSuccess(issue) ? issue.value : null;
  const target = addresses.find(({ url }) => url === chosen) ?? addresses[0];
  if (target === undefined)
    return (
      <p className="text-xs text-muted-foreground">
        Turn on a way in under Ways in to pair a phone or another computer.
      </p>
    );
  return (
    <div className="flex flex-col gap-3">
      <form
        className="flex flex-col gap-2 sm:flex-row sm:items-end"
        onSubmit={(event) =>
          submitForm(event, async () =>
            createPairing({
              label: label.trim(),
              addresses: [target.url],
              trusted,
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
            <Select
              items={addresses.map(({ route, url }) => ({
                value: url,
                label: `${remoteRouteTitles[route]} · ${url}`,
              }))}
              value={target.url}
              onValueChange={(value) => {
                if (value) setChosen(value);
              }}
            >
              <SelectTrigger id="pairing-address" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {addresses.map(({ route, url }) => (
                  <SelectItem key={url} value={url}>
                    {`${remoteRouteTitles[route]} · ${url}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
        <Button
          type="submit"
          className="shrink-0"
          disabled={issue.waiting || label.trim() === ''}
        >
          {issue.waiting ? <Spinner /> : <LinkIcon />}
          Create pairing link
        </Button>
      </form>
      <Field orientation="horizontal">
        <Switch
          id="pairing-trusted"
          checked={trusted}
          onCheckedChange={setTrusted}
        />
        <Label htmlFor="pairing-trusted">
          The paired device can update Porcelain
        </Label>
      </Field>
      <p className="text-xs text-muted-foreground">
        The link opens through {remoteRouteTitles[target.route]}. The device
        will work only through the way in it pairs over. To use it through
        another way in too, pair it again through that one.
      </p>
      {AsyncResult.isFailure(issue) && (
        <Alert variant="destructive">
          <AlertDescription>
            {connectionErrorMessage(Cause.squash(issue.cause))}
          </AlertDescription>
        </Alert>
      )}
      {issued && (
        <Item variant="muted">
          <ItemMedia>
            <PairingQr link={issued.link} />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>Scan on {issued.label}</ItemTitle>
            <p
              aria-label="Pairing link"
              className="font-mono text-xs break-all text-muted-foreground"
            >
              {issued.link}
            </p>
            <p className="text-xs text-muted-foreground">
              Works once, until{' '}
              {new Date(issued.expiresAt).toLocaleTimeString()}.
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
          </ItemContent>
        </Item>
      )}
    </div>
  );
}
