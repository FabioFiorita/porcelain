import { Host, Menu, RNHostView } from '@expo/ui/swift-ui';
import { buttonStyle } from '@expo/ui/swift-ui/modifiers';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Icon } from './icon';
import { Text } from './text';

export function ContentMenu({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <Host matchContents>
      <Menu
        modifiers={[buttonStyle('plain')]}
        label={
          <RNHostView matchContents>
            <View
              accessible
              accessibilityRole="button"
              accessibilityLabel={label}
              className="min-h-11 flex-row items-center justify-center gap-2 rounded-2xl border border-border bg-background px-3 py-2"
            >
              <Text accessible={false} variant="ui" weight="medium">
                {label}
              </Text>
              <Icon name="down" size="small" tone="muted" />
            </View>
          </RNHostView>
        }
      >
        {children}
      </Menu>
    </Host>
  );
}
