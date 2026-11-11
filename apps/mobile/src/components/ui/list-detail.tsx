import { useState, type ReactNode } from 'react';
import { useAtomMount } from '@effect/atom-react';
import { Atom } from 'effect/reactivity';
import { DeviceType, deviceType } from 'expo-device';
import {
  BackHandler,
  Pressable,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInLeft,
  SlideOutLeft,
} from 'react-native-reanimated';
import { useFocusEffect, useNavigation, useRoute } from 'expo-router';
import {
  listPresentation,
  listDetailMode,
  layoutMove,
  listDetailModeChange,
  movesWithLayout,
  type LayoutMove,
  type ListDetailMode,
} from '../../shared/rules/list-detail';

const LIST_COLUMN_WIDTH = 340;

const tablet = deviceType === DeviceType.TABLET;

export type ListDetailLayout = {
  mode: ListDetailMode;
  measured: ListDetailMode | undefined;
  onLayout: (event: LayoutChangeEvent) => void;
};

export function useListDetailLayout(
  onChange?: (mode: ListDetailMode) => void,
): ListDetailLayout {
  const [width, setWidth] = useState<number>();
  return {
    mode: listDetailMode({ tablet, width }),
    measured:
      width === undefined ? undefined : listDetailMode({ tablet, width }),
    onLayout: ({ nativeEvent }) => {
      const next = nativeEvent.layout.width;
      const change = listDetailModeChange({ tablet, from: width, to: next });
      setWidth(next);
      if (change) onChange?.(change);
    },
  };
}

export function useLayoutMove({
  place,
  mode,
  collapsing = false,
  file,
  onMove,
}: {
  place: 'root' | 'pushed';
  mode: ListDetailMode | undefined;
  collapsing?: boolean;
  file?: string | undefined;
  onMove: (move: Exclude<LayoutMove, { kind: 'none' }>) => void;
}) {
  const navigation = useNavigation();
  const route = useRoute();
  const [returned, setReturned] = useState(false);
  useFocusEffect(() => {
    const state = navigation.getState();
    const move = layoutMove({
      place,
      mode,
      focused: navigation.isFocused(),
      onTop: state
        ? movesWithLayout({
            routes: state.routes.map((entry) => entry.name),
            index: state.index,
            own: state.routes.findIndex((entry) => entry.key === route.key),
          })
        : false,
      collapsing,
      file,
    });
    if (move.kind === 'none' || returned) return;
    if (move.kind === 'return') setReturned(true);
    onMove(move);
  });
}

export function usePortrait() {
  const { width, height } = useWindowDimensions();
  return height > width;
}

type ListOverlay = { open: boolean; onDismiss?: (() => void) | undefined };

const dismissOnBack = Atom.family((dismiss: () => void) =>
  Atom.make((get) => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        dismiss();
        return true;
      },
    );
    get.addFinalizer(() => subscription.remove());
  }),
);

const keepBack = Atom.make(undefined);

export function ListDetail({
  list,
  detail,
  collapse = 'list',
  listHidden = false,
  overlay,
  layout,
}: {
  list: (mode: ListDetailMode) => ReactNode;
  detail: ReactNode;
  collapse?: 'list' | 'detail';
  listHidden?: boolean;
  overlay?: ListOverlay | undefined;
  layout?: ListDetailLayout;
}) {
  const own = useListDetailLayout();
  const portrait = usePortrait();
  const { mode, onLayout } = layout ?? own;
  const beside = mode === 'beside';
  const presentation = listPresentation({
    overlay: overlay !== undefined,
    portrait,
    hidden: listHidden,
    open: overlay?.open ?? false,
  });
  const over = beside && presentation === 'over';
  useAtomMount(
    over && overlay?.onDismiss ? dismissOnBack(overlay.onDismiss) : keepBack,
  );
  const showList = beside ? presentation === 'beside' : collapse === 'list';
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
      {over && overlay?.onDismiss ? (
        <Animated.View
          key="scrim"
          entering={FadeIn}
          exiting={FadeOut}
          className="absolute inset-0 bg-black/25"
        >
          <Pressable
            className="flex-1"
            accessibilityRole="button"
            accessibilityLabel="Close list"
            onPress={overlay.onDismiss}
          />
        </Animated.View>
      ) : null}
      {over ? (
        <Animated.View
          key="over"
          entering={SlideInLeft}
          exiting={SlideOutLeft}
          className="absolute top-0 bottom-0 left-0 border-r border-border bg-background shadow-xl"
          collapsable={false}
          style={{ width: LIST_COLUMN_WIDTH }}
        >
          {list(mode)}
        </Animated.View>
      ) : null}
    </View>
  );
}
