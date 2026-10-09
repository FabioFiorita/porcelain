import { View } from 'react-native';
import { useState } from 'react';
import { Button, ContextMenu, Host, RNHostView } from '@expo/ui/swift-ui';
import { disabled } from '@expo/ui/swift-ui/modifiers';
import { Item } from './item';
import type { ItemMenuProps } from './item-menu-props';

export function ItemMenu({ actions, ...item }: ItemMenuProps) {
  const [width, setWidth] = useState(0);
  if (!actions.length) return <Item {...item} />;
  return (
    <View onLayout={({ nativeEvent }) => setWidth(nativeEvent.layout.width)}>
      <Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
        <ContextMenu>
          <ContextMenu.Trigger>
            <RNHostView matchContents>
              <View style={width ? { width } : undefined}>
                <Item {...item} />
              </View>
            </RNHostView>
          </ContextMenu.Trigger>
          <ContextMenu.Items>
            {actions.map((action) => (
              <Button
                key={action.id}
                label={action.label}
                {...(action.destructive
                  ? { role: 'destructive' as const }
                  : {})}
                modifiers={[disabled(action.disabled ?? false)]}
                onPress={action.onPress}
              />
            ))}
          </ContextMenu.Items>
        </ContextMenu>
      </Host>
    </View>
  );
}
