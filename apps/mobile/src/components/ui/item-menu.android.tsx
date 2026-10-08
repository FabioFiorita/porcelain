import { View } from 'react-native';
import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuItem,
  Host,
  RNHostView,
  Text,
} from '@expo/ui/jetpack-compose';
import { Item } from './item';
import type { ItemMenuProps } from './item-menu-props';

export function ItemMenu({ actions, ...item }: ItemMenuProps) {
  const [expanded, setExpanded] = useState(false);
  const [width, setWidth] = useState(0);
  if (!actions.length) return <Item {...item} />;
  return (
    <View onLayout={({ nativeEvent }) => setWidth(nativeEvent.layout.width)}>
      <Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
        <DropdownMenu
          expanded={expanded}
          onDismissRequest={() => setExpanded(false)}
        >
          <DropdownMenu.Trigger>
            <RNHostView matchContents>
              <View style={width ? { width } : undefined}>
                <Item {...item} onLongPress={() => setExpanded(true)} />
              </View>
            </RNHostView>
          </DropdownMenu.Trigger>
          <DropdownMenu.Items>
            {actions.map((action) => (
              <DropdownMenuItem
                key={action.id}
                enabled={!action.disabled}
                onClick={() => {
                  setExpanded(false);
                  action.onPress();
                }}
              >
                <DropdownMenuItem.Text>
                  <Text>{action.label}</Text>
                </DropdownMenuItem.Text>
              </DropdownMenuItem>
            ))}
          </DropdownMenu.Items>
        </DropdownMenu>
      </Host>
    </View>
  );
}
