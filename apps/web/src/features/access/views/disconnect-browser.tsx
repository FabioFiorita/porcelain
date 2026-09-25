import { UnplugIcon } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { connectionErrorMessage, useConnection } from '../queries/connection';

export function DisconnectBrowser() {
  const { disconnect, disconnectError, disconnectPending } = useConnection();
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
          disabled={disconnectPending}
          onClick={() => void disconnect()}
        >
          {disconnectPending ? <Spinner /> : <UnplugIcon />}
          Disconnect this browser
        </Button>
      </div>
      {disconnectError && (
        <Alert variant="destructive">
          <AlertDescription>
            {connectionErrorMessage(disconnectError)}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
