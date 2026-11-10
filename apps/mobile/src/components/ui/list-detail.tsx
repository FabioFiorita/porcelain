import { useState, type ReactNode } from 'react';
import { DeviceType, deviceType } from 'expo-device';
import { View, type LayoutChangeEvent } from 'react-native';
import {
  listDetailMode,
  listDetailModeChange,
  type ListDetailMode,
} from '../../shared/rules/list-detail';

const LIST_COLUMN_WIDTH = 340;

const tablet = deviceType === DeviceType.TABLET;

export type ListDetailLayout = {
  mode: ListDetailMode;
  onLayout: (event: LayoutChangeEvent) => void;
};

export function useListDetailLayout(
  onChange?: (mode: ListDetailMode) => void,
): ListDetailLayout {
  const [width, setWidth] = useState<number>();
  return {
    mode: listDetailMode({ tablet, width }),
    onLayout: ({ nativeEvent }) => {
      const next = nativeEvent.layout.width;
      const change = listDetailModeChange({ tablet, from: width, to: next });
      setWidth(next);
      if (change) onChange?.(change);
    },
  };
}

export function onBesideLayout(
  returnBeside: () => void,
): (event: LayoutChangeEvent) => void {
  return ({ nativeEvent }) => {
    if (
      listDetailMode({ tablet, width: nativeEvent.layout.width }) === 'beside'
    )
      returnBeside();
  };
}

export function ListDetail({
  list,
  detail,
  collapse = 'list',
  listHidden = false,
  layout,
}: {
  list: (mode: ListDetailMode) => ReactNode;
  detail: ReactNode;
  collapse?: 'list' | 'detail';
  listHidden?: boolean;
  layout?: ListDetailLayout;
}) {
  const own = useListDetailLayout();
  const { mode, onLayout } = layout ?? own;
  const beside = mode === 'beside';
  const showList = beside ? !listHidden : collapse === 'list';
  const showDetail = beside || collapse === 'detail';
  return (
    <View
      className="flex-1 flex-row bg-background"
      collapsable={false}
      onLayout={onLayout}
    >
      {showList ? (
        <View
          key="list"
          className={beside ? 'border-r border-border' : 'flex-1'}
          collapsable={false}
          style={beside ? { width: LIST_COLUMN_WIDTH } : undefined}
        >
          {list(mode)}
        </View>
      ) : null}
      {showDetail ? (
        <View key="detail" className="flex-1" collapsable={false}>
          {detail}
        </View>
      ) : null}
    </View>
  );
}
