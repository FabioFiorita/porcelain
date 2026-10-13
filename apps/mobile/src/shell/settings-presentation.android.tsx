import { SettingsScreen } from '../features/access';
import type { SettingsPresentationProps } from './settings-presentation-props';

export function SettingsPresentation(props: SettingsPresentationProps) {
  return <SettingsScreen {...props} />;
}
