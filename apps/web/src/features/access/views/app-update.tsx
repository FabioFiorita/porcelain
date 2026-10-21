import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
  useAppUpdate,
  useAppUpdateState,
  useDesktopCapabilities,
} from '../queries/app-update';
import { useSettingsUpdates } from '../queries/settings-updates';
import { appUpdateCheckVisible, appUpdateProgress } from '../rules/app-update';
import { SettingsUpdateRow } from './settings-update-row';

export function AppUpdateSettings() {
  const { result, check } = useAppUpdate();
  const state = useAppUpdateState();
  const capabilities = Option.getOrUndefined(
    AsyncResult.value(useDesktopCapabilities()),
  );
  const { rows, batch } = useSettingsUpdates();
  const row = rows.find(({ target }) => target.kind === 'mac-app');
  return (
    <div className="flex flex-col gap-3">
      {row && <SettingsUpdateRow row={row} />}
      {!row && result.waiting && <Spinner />}
      {capabilities && appUpdateCheckVisible(capabilities) && (
        <Button
          size="sm"
          variant="outline"
          className="self-start"
          disabled={
            batch.running ||
            result.waiting ||
            appUpdateProgress(state) !== undefined
          }
          onClick={check}
        >
          Check for updates
        </Button>
      )}
    </div>
  );
}
