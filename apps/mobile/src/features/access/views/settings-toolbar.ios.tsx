import { Stack } from 'expo-router';
import { Button, Host } from '@expo/ui/swift-ui';
import {
  accessibilityIdentifier,
  accessibilityLabel,
  disabled,
  labelStyle,
} from '@expo/ui/swift-ui/modifiers';
import type { SettingsToolbarProps } from './settings-toolbar-props';

export const settingsHeaderVisible = true;

export function SettingsToolbar(props: SettingsToolbarProps) {
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
