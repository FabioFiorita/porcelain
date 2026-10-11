import { Cause, Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useInstallAppUpdate } from '../commands/app-update';
import {
  useAppUpdate,
  useAppUpdateState,
  useDesktopCapabilities,
} from '../queries/app-update';
import {
  appUpdateCheckVisible,
  appUpdateProgress,
  noUpdateMessage,
} from '../rules/app-update';
import { connectionErrorMessage } from '@porcelain/client/access/rules';

export function AppUpdateSettings() {
  const { result: update, check } = useAppUpdate();
  const install = useInstallAppUpdate();
  const state = useAppUpdateState();
  const capabilities = Option.getOrUndefined(
    AsyncResult.value(useDesktopCapabilities()),
  );
  const info = Option.getOrUndefined(Option.flatten(AsyncResult.value(update)));
  if (!info) return AsyncResult.isInitial(update) ? <Spinner /> : null;
  const progress = appUpdateProgress(state);
  const checkFailed = AsyncResult.isFailure(update) && !update.waiting;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium">Porcelain app {info.current}</p>
      {progress ? (
        <div aria-live="polite" className="flex items-center gap-2 text-sm">
          <Spinner />
          <p>{progress}</p>
        </div>
      ) : state.status === 'available' ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm">Porcelain app {state.version} is available.</p>
          <Button
            size="sm"
            disabled={update.waiting || install.result.waiting}
            onClick={() => install.install()}
          >
            Update to {state.version}
          </Button>
        </div>
      ) : state.status !== 'error' && !AsyncResult.isFailure(update) ? (
        <p className="text-xs text-muted-foreground">
          {noUpdateMessage(state)}
        </p>
      ) : null}
      {capabilities && appUpdateCheckVisible(capabilities) && (
        <Button
          size="sm"
          variant="outline"
          className="self-start"
          disabled={update.waiting || progress !== undefined}
          onClick={check}
        >
          Check for updates
        </Button>
      )}
      {(state.status === 'error' ||
        checkFailed ||
        AsyncResult.isFailure(install.result)) && (
        <Alert variant="destructive">
          <AlertDescription>
            {state.status === 'error'
              ? state.message
              : checkFailed
                ? connectionErrorMessage(Cause.squash(update.cause))
                : AsyncResult.isFailure(install.result)
                  ? connectionErrorMessage(Cause.squash(install.result.cause))
                  : undefined}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
