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
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import {
  useFocusEffect,
  useIsFocused,
  useNavigation,
  useRoute,
} from 'expo-router';
import {
  listPresentation,
  listDetailMode,
  layoutMove,
  listDetailModeChange,
  movesWithLayout,
  type LayoutMove,
  type ListPresentation,
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
  list: (mode: ListDetailMode, presentation: ListPresentation) => ReactNode;
  detail: ReactNode;
  collapse?: 'list' | 'detail';
  listHidden?: boolean;
  overlay?: ListOverlay | undefined;
  layout?: ListDetailLayout;
}) {
  const own = useListDetailLayout();
  const portrait = usePortrait();
  const focused = useIsFocused();
  const { mode, onLayout } = layout ?? own;
  const beside = mode === 'beside';
  const presentation = listPresentation({
    overlay: overlay !== undefined,
    portrait,
    hidden: listHidden,
    open: overlay?.open ?? false,
  });
  const sliding = beside && overlay !== undefined && portrait;
  const over = sliding && presentation === 'over';
  useAtomMount(
    over && focused && overlay?.onDismiss
      ? dismissOnBack(overlay.onDismiss)
      : keepBack,
  );
  const panel = useAnimatedStyle(
    () => ({
      transform: [
        {
          translateX: withTiming(sliding && !over ? -LIST_COLUMN_WIDTH : 0),
        },
      ],
    }),
    [sliding, over],
  );
  const dim = useAnimatedStyle(
    () => ({ opacity: withTiming(over ? 1 : 0) }),
    [over],
  );
  const showList = beside
    ? sliding || presentation === 'beside'
    : collapse === 'list';
  const showDetail = beside || collapse === 'detail';
  const shown = !sliding || over;
  return (
    <View
      className="flex-1 flex-row bg-background"
      collapsable={false}
      onLayout={onLayout}
    >
      {showList ? (
        <Animated.View
          key="list"
          className={
            sliding
              ? 'absolute top-0 bottom-0 left-0 z-10 border-r border-border bg-background shadow-xl'
              : beside
                ? 'border-r border-border'
                : 'flex-1'
          }
          collapsable={false}
          pointerEvents={shown ? 'auto' : 'none'}
          accessibilityElementsHidden={!shown}
          importantForAccessibility={shown ? 'auto' : 'no-hide-descendants'}
          style={[beside ? { width: LIST_COLUMN_WIDTH } : undefined, panel]}
        >
          {list(mode, shown ? (over ? 'over' : 'beside') : 'hidden')}
        </Animated.View>
      ) : null}
      {showDetail ? (
        <View key="detail" className="flex-1" collapsable={false}>
          {detail}
        </View>
      ) : null}
      {sliding ? (
        <Animated.View
          key="scrim"
          className="absolute inset-0 z-5 bg-black/25"
          pointerEvents={over && overlay?.onDismiss ? 'auto' : 'none'}
          style={dim}
        >
          <Pressable
            className="flex-1"
            accessibilityRole="button"
            accessibilityLabel="Close list"
            onPress={overlay?.onDismiss}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}
