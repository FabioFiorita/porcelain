import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { devPairing } from '@/shared/shell';

function pairingAddress() {
  return typeof window === 'undefined'
    ? 'http://127.0.0.1:3000'
    : window.location.origin;
}

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
      {devPairing && (
        <form
          method="post"
          action="/__porcelain/dev/pair"
          className="flex flex-wrap items-center gap-3 rounded-md border border-dashed p-3"
        >
          <p className="min-w-0 flex-1 text-sm text-muted-foreground">
            This is a development server, so it can pair this browser directly.
          </p>
          <Button type="submit" size="sm">
            Pair this browser
          </Button>
        </form>
      )}
      {reason && (
        <Alert variant="destructive">
          <AlertDescription>{reason}</AlertDescription>
        </Alert>
      )}
    </section>
  );
}
