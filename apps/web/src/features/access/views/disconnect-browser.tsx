import { PendingButton } from '@/shared/views/pending-button';
import { Cause } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { useConnectedContext } from '../store';
import { UnplugIcon } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ItemDescription, ItemTitle } from '@/components/ui/item';
import { useDisconnect } from '../commands/disconnect';
import { connectionErrorMessage } from '@porcelain/client/access/rules';

export function DisconnectBrowser({ computer }: { computer: string }) {
  const { connection } = useConnectedContext();
  const { result: disconnect, submit } = useDisconnect(connection);
  return (
    <div className="flex flex-col gap-3">
      <div className="settings-danger flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <ItemTitle>Disconnect this browser</ItemTitle>
          <ItemDescription>
            Ends its session on {computer}. Pair it again with a new link.
          </ItemDescription>
        </div>
        <PendingButton
          pending={disconnect.waiting}
          variant="outline"
          size="sm"
          className="shrink-0 self-start sm:self-auto"
          aria-label="Disconnect this browser"
          onClick={submit}
        >
          <UnplugIcon />
          Disconnect
        </PendingButton>
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
