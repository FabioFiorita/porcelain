import { Alert, AlertDescription } from '@/components/ui/alert';

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
      {reason && (
        <Alert variant="destructive">
          <AlertDescription>{reason}</AlertDescription>
        </Alert>
      )}
    </section>
  );
}
