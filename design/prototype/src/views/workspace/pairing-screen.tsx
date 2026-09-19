import { Outlet, useRouter } from '@tanstack/react-router';
import { Copy, Link2, ShieldOff } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';
import logo from '../../assets/logo.png';
import {
  pairingCode,
  useConnectionState,
  usePair,
} from '../../query/connection';
import { reviewErrorMessage } from '../../query/review';
import { copyText } from './copy';
import { DialogIcon } from './dialog-icon';

const PAIR_COMMAND = 'porcelain pair';

/**
 * The root of the app: the workspace while this browser is a paired device, the
 * pairing screen otherwise. Any request answering `NOT_PAIRED` or `DEVICE_REVOKED`
 * flips the connection store (see main.tsx), so this replaces whatever was on screen.
 */
export function ConnectionGate() {
  const { pairing } = useConnectionState();
  if (pairing === 'paired') return <Outlet />;
  return <PairingScreen revoked={pairing === 'revoked'} />;
}

/** "Chrome on macOS", from what the browser says about itself. The reviewer can change it. */
function defaultDeviceName(userAgent = navigator.userAgent): string {
  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /OPR\//.test(userAgent)
      ? 'Opera'
      : /Firefox\//.test(userAgent)
        ? 'Firefox'
        : /Chrome\//.test(userAgent)
          ? 'Chrome'
          : /Safari\//.test(userAgent)
            ? 'Safari'
            : 'Browser';
  const system = /iPhone/.test(userAgent)
    ? 'iPhone'
    : /iPad/.test(userAgent)
      ? 'iPad'
      : /Android/.test(userAgent)
        ? 'Android'
        : /Mac OS X|Macintosh/.test(userAgent)
          ? 'macOS'
          : /Windows/.test(userAgent)
            ? 'Windows'
            : /CrOS/.test(userAgent)
              ? 'ChromeOS'
              : /Linux/.test(userAgent)
                ? 'Linux'
                : null;
  return system == null ? browser : `${browser} on ${system}`;
}

/** A pairing link opened in this browser (`…/pair#code=…`) fills the field by itself. */
function linkFromLocation(): string {
  return /[#?&]code=/.test(window.location.href) ? window.location.href : '';
}

const errorCode = (error: unknown) =>
  typeof error === 'object' && error != null && 'code' in error
    ? String((error as { code: unknown }).code)
    : undefined;

function PairingError({ error }: { error: unknown }) {
  switch (errorCode(error)) {
    case 'PAIRING_LINK_EXPIRED':
      return (
        <>
          This link expired. Links last 15 minutes: run{' '}
          <code className="font-mono">{PAIR_COMMAND}</code> again for a new one.
        </>
      );
    case 'PAIRING_LINK_USED':
      return (
        <>
          This link was already used. Each link pairs one browser: run{' '}
          <code className="font-mono">{PAIR_COMMAND}</code> again for a new one.
        </>
      );
    default:
      return <>{reviewErrorMessage(error)}</>;
  }
}

/**
 * Only the owner pairs a browser, from the server machine: `porcelain pair` prints
 * a link that lasts 15 minutes and works once. Nothing here asks for a password or
 * a token; the device token lands in an HttpOnly cookie.
 */
export function PairingScreen({ revoked }: { revoked: boolean }) {
  const pair = usePair();
  const router = useRouter();
  const [link, setLink] = useState(linkFromLocation);
  const [deviceName, setDeviceName] = useState(() => defaultDeviceName());
  const code = pairingCode(link);

  const submit = () => {
    if (code === '' || pair.isPending) return;
    const label = deviceName.trim() || defaultDeviceName();
    pair.submit({ code, label }).then(
      (session) => {
        toast.add({
          title: `Paired with ${session.server.name}`,
          description: `This browser is “${session.device.label}”.`,
          type: 'success',
        });
        // Opened from the link itself: land on the workspace, not on /pair.
        if (window.location.pathname !== '/' || window.location.hash !== '')
          void router.navigate({ to: '/', hash: '' });
      },
      () => undefined,
    );
  };

  return (
    // Anchored near the top, not centred, so an error appearing below the fields moves nothing above it.
    <main className="flex min-h-svh justify-center bg-muted px-4 pt-[max(1rem,14svh)] pb-4 text-[13px] text-foreground">
      <div className="flex w-full max-w-md flex-col gap-5">
        <div className="flex items-center justify-center gap-2">
          <img
            src={logo}
            alt=""
            draggable={false}
            className="size-6 rounded-md"
          />
          <span className="text-sm font-semibold">Porcelain</span>
        </div>

        <form
          className="flex flex-col gap-5 rounded-2xl border bg-card p-6 shadow-sm"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <header className="flex items-center gap-3">
            <DialogIcon
              icon={revoked ? ShieldOff : Link2}
              tone={revoked ? 'destructive' : 'default'}
            />
            <div className="flex flex-col gap-0.5">
              <h1 className="text-base leading-tight font-medium">
                {revoked
                  ? 'This browser was revoked on the server'
                  : 'Pair this browser'}
              </h1>
              <p className="text-[12.5px] text-muted-foreground">
                {revoked
                  ? 'It can’t read anything until it is paired again with a new link.'
                  : 'Porcelain only answers browsers paired with its server.'}
              </p>
            </div>
          </header>

          <ol className="flex flex-col gap-4">
            <li className="flex flex-col gap-1.5">
              <p className="text-[12.5px] font-medium">
                1. On the server machine, run
              </p>
              <div className="flex items-center gap-2 rounded-xl border bg-muted/50 py-1 pr-1 pl-3">
                <code className="min-w-0 flex-1 font-mono text-[12px]">
                  {PAIR_COMMAND}
                </code>
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  aria-label="Copy the command"
                  title="Copy the command"
                  onClick={() => copyText(PAIR_COMMAND, 'command')}
                >
                  <Copy />
                </Button>
              </div>
            </li>
            <li className="flex flex-col gap-1.5">
              <label
                htmlFor="pairing-link"
                className="text-[12.5px] font-medium"
              >
                2. Paste the link it prints
              </label>
              <Input
                id="pairing-link"
                value={link}
                autoFocus
                autoComplete="off"
                spellCheck={false}
                placeholder="http://…/pair#code=…"
                aria-invalid={pair.error != null || undefined}
                aria-describedby="pairing-link-hint"
                className="font-mono text-[12px]!"
                onChange={(event) => {
                  setLink(event.target.value);
                  if (pair.error != null) pair.reset();
                }}
              />
              <p
                id="pairing-link-hint"
                className="text-[11.5px] text-muted-foreground"
              >
                A link lasts 15 minutes and works once. The code on its own
                works too.
              </p>
            </li>
            <li className="flex flex-col gap-1.5">
              <label
                htmlFor="device-name"
                className="text-[12.5px] font-medium"
              >
                3. Name this browser
              </label>
              <Input
                id="device-name"
                value={deviceName}
                maxLength={80}
                autoComplete="off"
                aria-describedby="device-name-hint"
                onChange={(event) => setDeviceName(event.target.value)}
              />
              <p
                id="device-name-hint"
                className="text-[11.5px] text-muted-foreground"
              >
                How the server lists it, so you know which one to revoke later.
              </p>
            </li>
          </ol>

          {pair.error != null && (
            <p
              role="alert"
              className="rounded-xl bg-destructive/10 px-3 py-2 text-[12.5px] text-destructive"
            >
              <PairingError error={pair.error} />
            </p>
          )}

          <Button type="submit" disabled={code === '' || pair.isPending}>
            {pair.isPending && <Spinner />}
            Pair this browser
          </Button>
        </form>
      </div>
    </main>
  );
}
