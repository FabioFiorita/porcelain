import { Stack } from 'expo-router';
import { DeviceType, deviceType } from 'expo-device';
import { Button, Host } from '@expo/ui/swift-ui';
import {
  accessibilityIdentifier,
  accessibilityLabel,
  disabled,
  labelStyle,
} from '@expo/ui/swift-ui/modifiers';
import type { SettingsToolbarProps } from './settings-toolbar-props';

export const settingsHeaderVisible = deviceType !== DeviceType.TABLET;

export function SettingsToolbar(props: SettingsToolbarProps) {
  if (!settingsHeaderVisible) return null;
  return (
    <Stack.Toolbar placement="right">
      <Stack.Toolbar.View>
        <Host matchContents>
          <Button
            label="Add environment"
            systemImage="plus"
            onPress={props.onAdd}
            modifiers={[
              accessibilityIdentifier('add-environment'),
              accessibilityLabel('Add environment'),
              labelStyle('iconOnly'),
              disabled(props.disabled),
            ]}
          />
        </Host>
      </Stack.Toolbar.View>
    </Stack.Toolbar>
  );
}
