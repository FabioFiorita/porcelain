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

type Check = ReturnType<typeof useAppUpdate>['result'];
type Install = ReturnType<typeof useInstallAppUpdate>;
type State = ReturnType<typeof useAppUpdateState>;

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
  const failure = appUpdateFailure(state, update, install.result);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium">Porcelain app {info.current}</p>
      <AppUpdateOffer
        progress={progress}
        state={state}
        update={update}
        install={install}
      />
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
      {failure !== undefined && (
        <Alert variant="destructive">
          <AlertDescription>{failure}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function AppUpdateOffer({
  progress,
  state,
  update,
  install,
}: {
  progress: string | undefined;
  state: State;
  update: Check;
  install: Install;
}) {
  if (progress)
    return (
      <div aria-live="polite" className="flex items-center gap-2 text-sm">
        <Spinner />
        <p>{progress}</p>
      </div>
    );
  if (state.status === 'available')
    return (
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
    );
  if (state.status === 'error' || AsyncResult.isFailure(update)) return null;
  return (
    <p className="text-xs text-muted-foreground">{noUpdateMessage(state)}</p>
  );
}

function appUpdateFailure(
  state: State,
  update: Check,
  install: Install['result'],
) {
  if (state.status === 'error') return state.message;
  if (AsyncResult.isFailure(update) && !update.waiting)
    return connectionErrorMessage(Cause.squash(update.cause));
  if (AsyncResult.isFailure(install))
    return connectionErrorMessage(Cause.squash(install.cause));
  return undefined;
}
