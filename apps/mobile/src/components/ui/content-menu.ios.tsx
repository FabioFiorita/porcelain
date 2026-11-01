import { Host, Menu, RNHostView } from '@expo/ui/swift-ui';
import { buttonStyle } from '@expo/ui/swift-ui/modifiers';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Icon, type IconName } from './icon';
import { Text } from './text';

export function ContentMenu({
  label,
  maximumWidth,
  children,
  icon,
  size = 'default',
}: {
  label: string;
  maximumWidth?: number | undefined;
  icon?: IconName;
  size?: 'default' | 'sm';
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
              style={{ maxWidth: maximumWidth }}
              className="min-h-11 min-w-11 items-center justify-center"
            >
              <View
                className={[
                  'max-w-full flex-row items-center justify-center gap-2 rounded-md border border-border bg-background',
                  size === 'sm'
                    ? icon
                      ? 'min-h-8 w-8'
                      : 'min-h-8 px-2.5 py-1'
                    : 'min-h-11 px-3 py-2',
                ].join(' ')}
              >
                {icon ? (
                  <Icon
                    name={icon}
                    size={size === 'sm' ? 'control' : 'default'}
                  />
                ) : (
                  <>
                    <Text
                      accessible={false}
                      variant="control"
                      weight="medium"
                      numberOfLines={1}
                      className="shrink"
                    >
                      {label}
                    </Text>
                    <Icon name="down" size="small" tone="muted" />
                  </>
                )}
              </View>
            </View>
          </RNHostView>
        }
      >
        {children}
      </Menu>
    </Host>
  );
}
