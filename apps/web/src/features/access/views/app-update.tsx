import { useSettingsUpdates } from '../queries/settings-updates';
import { SettingsUpdateRow } from './settings-update-row';

export function AppUpdateSettings({
  prominent = false,
}: {
  prominent?: boolean;
}) {
  const { rows } = useSettingsUpdates();
  const row = rows.find(({ target }) => target.kind === 'mac-app');
  if (row) return <SettingsUpdateRow row={row} prominent={prominent} />;
  return null;
}
