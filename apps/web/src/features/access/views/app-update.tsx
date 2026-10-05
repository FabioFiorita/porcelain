import { useEffect, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { desktopAppUpdate } from '@/shared/adapters/desktop';
import { useInstallAppUpdate } from '../commands/app-update';
import { useAppUpdate } from '../queries/app-update';
import {
  appUpdateProgress,
  noUpdateMessage,
  type AppUpdateState,
} from '../rules/app-update';
import { connectionErrorMessage } from '@porcelain/client/access/rules';

export function AppUpdateSettings() {
  const update = useAppUpdate();
  const install = useInstallAppUpdate();
  const [state, setState] = useState<AppUpdateState>({
    status: 'idle',
  });
  useEffect(() => desktopAppUpdate()?.onState(setState), []);
  const info = update.data;
  if (!info) return update.isPending ? <Spinner /> : null;
  const progress = appUpdateProgress(state);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium">Porcelain app {info.current}</p>
      {progress ? (
        <div aria-live="polite" className="flex items-center gap-2 text-sm">
          <Spinner />
          <p>{progress}</p>
        </div>
      ) : info.available ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm">
            Porcelain app {info.available} is available.
          </p>
          <Button
            size="sm"
            disabled={install.isPending}
            onClick={() => install.onSubmit()}
          >
            Update to {info.available}
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {noUpdateMessage(state)}
        </p>
      )}
      {(state.status === 'error' || install.error) && (
        <Alert variant="destructive">
          <AlertDescription>
            {state.status === 'error'
              ? state.message
              : connectionErrorMessage(install.error)}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
