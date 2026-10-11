import { Stack } from 'expo-router';
import { headerIcon } from '../../../shared/icons/header-icon';
import type { SettingsToolbarProps } from './settings-toolbar-props';

export const settingsHeaderVisible = true;

export function SettingsToolbar(props: SettingsToolbarProps) {
  return (
    <Stack.Toolbar placement="right">
      <Stack.Toolbar.Button
        icon={headerIcon('add')}
        accessibilityLabel="Add environment"
        disabled={props.disabled}
        onPress={props.onAdd}
      />
    </Stack.Toolbar>
  );
}
