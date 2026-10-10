import { Cause, Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useInstallAppUpdate } from '../commands/app-update';
import { useAppUpdate, useAppUpdateState } from '../queries/app-update';
import { appUpdateProgress, noUpdateMessage } from '../rules/app-update';
import { connectionErrorMessage } from '@porcelain/client/access/rules';

export function AppUpdateSettings() {
  const update = useAppUpdate();
  const install = useInstallAppUpdate();
  const state = useAppUpdateState();
  const info = Option.getOrUndefined(Option.flatten(AsyncResult.value(update)));
  if (!info) return AsyncResult.isInitial(update) ? <Spinner /> : null;
  const progress = appUpdateProgress(state);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium">Porcelain app {info.current}</p>
      {(() => {
        if (progress) {
          return (
            <div aria-live="polite" className="flex items-center gap-2 text-sm">
              <Spinner />
              <p>{progress}</p>
            </div>
          );
        }
        if (info.available) {
          return (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm">
                Porcelain app {info.available} is available.
              </p>
              <Button
                size="sm"
                disabled={install.result.waiting}
                onClick={() => install.install()}
              >
                Update to {info.available}
              </Button>
            </div>
          );
        }
        return (
          <p className="text-xs text-muted-foreground">
            {noUpdateMessage(state)}
          </p>
        );
      })()}
      {(state.status === 'error' || AsyncResult.isFailure(install.result)) && (
        <Alert variant="destructive">
          <AlertDescription>
            {(() => {
              if (state.status === 'error') {
                return state.message;
              }
              if (AsyncResult.isFailure(install.result)) {
                return connectionErrorMessage(
                  Cause.squash(install.result.cause),
                );
              }
              return undefined;
            })()}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
