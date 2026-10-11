import { useState, type ReactElement } from 'react';
import { View } from 'react-native';
import { Item, type ItemProps } from './item';
import type { ItemMenuProps } from './item-menu-props';

export function MeasuredItemMenu({
  actions,
  item,
  onLongPress,
  menu,
}: {
  actions: ItemMenuProps['actions'];
  item: ItemProps;
  onLongPress?: () => void;
  menu: (row: ReactElement) => ReactElement;
}) {
  const [width, setWidth] = useState(0);
  if (!actions.length) return <Item {...item} />;
  return (
    <View onLayout={({ nativeEvent }) => setWidth(nativeEvent.layout.width)}>
      {menu(
        <View style={width ? { width } : undefined}>
          <Item {...item} {...(onLongPress ? { onLongPress } : {})} />
        </View>,
      )}
    </View>
  );
}
