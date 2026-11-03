import { useState, type ReactNode } from 'react';
import { DeviceType, deviceType } from 'expo-device';
import { View } from 'react-native';
import {
  listDetailMode,
  type ListDetailMode,
} from '../../shared/rules/list-detail';

const LIST_COLUMN_WIDTH = 340;

const tablet = deviceType === DeviceType.TABLET;

export function ListDetail({
  list,
  detail,
  collapse = 'list',
}: {
  list: (mode: ListDetailMode) => ReactNode;
  detail: ReactNode;
  collapse?: 'list' | 'detail';
}) {
  const [width, setWidth] = useState<number>();
  const mode = listDetailMode({ tablet, width });
  return (
    <View
      className="flex-1 flex-row bg-background"
      collapsable={false}
      onLayout={({ nativeEvent }) => setWidth(nativeEvent.layout.width)}
    >
      {mode === 'beside' ? (
        <>
          <View
            className="border-r border-border"
            style={{ width: LIST_COLUMN_WIDTH }}
          >
            {list(mode)}
          </View>
          <View className="flex-1" collapsable={false}>
            {detail}
          </View>
        </>
      ) : (
        <View className="flex-1" collapsable={false}>
          {collapse === 'list' ? list(mode) : detail}
        </View>
      )}
    </View>
  );
}
