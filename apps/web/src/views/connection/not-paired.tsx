import { Alert, AlertDescription } from '@/components/ui/alert';

/**
 * The address to pair against, which is the one this page was served from.
 *
 * Pairing refuses a link aimed anywhere the server does not answer, and the
 * origin in the address bar is by construction one that it does: the browser
 * is reading this page through it. So the command below is correct for
 * whatever port, LAN address or Tailscale name the owner is actually using,
 * without the server having to discover its own interfaces.
 */
function pairingAddress() {
  return typeof window === 'undefined'
    ? 'http://127.0.0.1:3000'
    : window.location.origin;
}

/**
 * What the owner sees when this browser has no credential: there is nothing to
 * type. Access arrives as a link the owner opens on this device, so the screen
 * says how to make one rather than offering a field to paste a secret into.
 */
export function NotPaired({ reason }: { reason?: string }) {
  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">This browser is not paired</h2>
        <p className="text-sm text-muted-foreground">
          Run this on the machine hosting Porcelain, then open the link it
          prints on this device.
        </p>
      </div>
      <pre className="overflow-x-auto rounded-md border bg-muted p-3 text-sm">
        <code>{`porcelain pair "This browser" --address ${pairingAddress()}`}</code>
      </pre>
      <p className="text-sm text-muted-foreground">
        The link works once and expires. Revoke this device at any time with{' '}
        <code>porcelain devices</code> and <code>porcelain revoke</code>.
      </p>
      {reason && (
        <Alert variant="destructive">
          <AlertDescription>{reason}</AlertDescription>
        </Alert>
      )}
    </section>
  );
}
