import { UnplugIcon } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useDisconnect } from '../commands/disconnect';
import { connectionErrorMessage } from '../queries/session';

export function DisconnectBrowser() {
  const disconnect = useDisconnect();
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
          disabled={disconnect.isPending}
          onClick={() => disconnect.submit()}
        >
          {disconnect.isPending ? <Spinner /> : <UnplugIcon />}
          Disconnect this browser
        </Button>
      </div>
      {disconnect.error && (
        <Alert variant="destructive">
          <AlertDescription>
            {connectionErrorMessage(disconnect.error)}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
