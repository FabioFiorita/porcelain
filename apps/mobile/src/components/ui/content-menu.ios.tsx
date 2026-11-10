import { Host, Menu, RNHostView } from '@expo/ui/swift-ui';
import { buttonStyle } from '@expo/ui/swift-ui/modifiers';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { hitTarget } from './hit-target';
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
    <Host matchContents ignoreSafeArea="all">
      <Menu
        modifiers={[buttonStyle('plain')]}
        label={
          <RNHostView matchContents>
            <View
              accessible
              accessibilityRole="button"
              accessibilityLabel={label}
              style={{ maxWidth: maximumWidth }}
              className={[
                hitTarget,
                'max-w-full flex-row items-center justify-center gap-1',
                icon ? '' : 'px-1',
              ].join(' ')}
            >
              {icon ? (
                <Icon name={icon} size={size === 'sm' ? 'control' : 'glyph'} />
              ) : (
                <>
                  <Text
                    accessible={false}
                    variant={size === 'sm' ? 'secondary' : 'body'}
                    weight="medium"
                    tone="brand"
                    numberOfLines={1}
                    className="shrink"
                  >
                    {label}
                  </Text>
                  <Icon name="down" size="small" tone="brand" />
                </>
              )}
            </View>
          </RNHostView>
        }
      >
        {children}
      </Menu>
    </Host>
  );
}
