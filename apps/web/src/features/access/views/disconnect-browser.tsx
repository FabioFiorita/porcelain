import { Cause } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { useConnectedContext } from '../store';
import { UnplugIcon } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useDisconnect } from '../commands/disconnect';
import { connectionErrorMessage } from '@porcelain/client/access/rules';

export function DisconnectBrowser() {
  const { connection } = useConnectedContext();
  const { result: disconnect, submit } = useDisconnect(connection);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <p className="text-sm font-medium">This browser</p>
          <p className="text-xs text-muted-foreground">
            Ends its session here. Pair it again with a new link.
          </p>
        </div>
        <Button
          variant="outline"
          className="shrink-0"
          disabled={disconnect.waiting}
          onClick={submit}
        >
          {disconnect.waiting ? <Spinner /> : <UnplugIcon />}
          Disconnect this browser
        </Button>
      </div>
      {AsyncResult.isFailure(disconnect) && (
        <Alert variant="destructive">
          <AlertDescription>
            {connectionErrorMessage(Cause.squash(disconnect.cause))}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
