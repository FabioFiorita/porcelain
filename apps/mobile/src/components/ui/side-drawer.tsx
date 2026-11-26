import { Fragment, useState, type ReactNode } from 'react';
import {
  BackHandler,
  PanResponder,
  Pressable,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DeviceType, deviceType } from 'expo-device';
import { useAtomMount } from '@effect/atom-react';
import { scheduleOnRN } from 'react-native-worklets';
import { Atom } from 'effect/reactivity';
import { reservedDrawerEdge } from './drawer-edge';
import { nativeTabSidebar } from './native-sidebar';
import {
  drawerMode,
  drawerWidth,
  settlesOpen,
  startsDrawerSwipe,
  type DrawerMode,
} from '../../shared/rules/side-drawer';

const tablet = deviceType === DeviceType.TABLET;
const SLIDE_MS = 220;

const closeOnBack = Atom.family((close: () => void) =>
  Atom.make((get) => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        close();
        return true;
      },
    );
    get.addFinalizer(() => subscription.remove());
  }),
);

const keepBack = Atom.make(undefined);

export function useDrawerMode(): DrawerMode {
  return drawerMode({
    tablet,
    width: useWindowDimensions().width,
    nativeSidebar: nativeTabSidebar,
  });
}

export function SideDrawer({
  open,
  hidden,
  swipe,
  onOpenChange,
  drawer,
  rail,
  children,
}: {
  open: boolean;
  hidden: boolean;
  swipe: boolean;
  onOpenChange: (open: boolean) => void;
  drawer: ReactNode;
  rail: ReactNode;
  children: ReactNode;
}) {
  const { width } = useWindowDimensions();
  const mode = useDrawerMode();
  const size = drawerWidth(width);
  const insets = useSafeAreaInsets();
  const panel = (
    <View
      className="flex-1 bg-background"
      collapsable={false}
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      {drawer}
    </View>
  );
  if (mode !== 'overlay') {
    const pinned = mode === 'pinned' && !hidden;
    return (
      <SlidingDrawer
        open={!pinned && open}
        swipe={!pinned && swipe}
        size={size}
        onOpenChange={onOpenChange}
        panel={pinned ? null : panel}
      >
        <View className="flex-1 flex-row" collapsable={false}>
          {pinned ? (
            <View
              key="sidebar"
              className="border-r border-border"
              style={{ width: size }}
              collapsable={false}
            >
              {panel}
            </View>
          ) : (
            <Fragment key="rail">{rail}</Fragment>
          )}
          <View key="content" className="flex-1" collapsable={false}>
            {children}
          </View>
        </View>
      </SlidingDrawer>
    );
  }
  return (
    <SlidingDrawer
      open={open}
      swipe={swipe}
      size={size}
      onOpenChange={onOpenChange}
      panel={panel}
    >
      {children}
    </SlidingDrawer>
  );
}

function SlidingDrawer({
  open,
  swipe,
  size,
  onOpenChange,
  panel,
  children,
}: {
  open: boolean;
  swipe: boolean;
  size: number;
  onOpenChange: (open: boolean) => void;
  panel: ReactNode;
  children: ReactNode;
}) {
  const offset = useSharedValue(open ? size : 0);
  const [shown, setShown] = useState(open);
  const [hidden, setHidden] = useState(!open);
  const [dragging, setDragging] = useState(false);
  const slide = (to: boolean) =>
    offset.set(
      withTiming(to ? size : 0, { duration: SLIDE_MS }, (finished) => {
        if (finished && !to) scheduleOnRN(setHidden, true);
      }),
    );
  if (shown !== open) {
    setShown(open);
    if (open) setHidden(false);
    slide(open);
  }
  useAtomMount(open ? closeOnBack(() => onOpenChange(false)) : keepBack);
  const responder = PanResponder.create({
    onMoveShouldSetPanResponder: (event, gesture) =>
      startsDrawerSwipe({
        open,
        enabled: swipe || open,
        startX: event.nativeEvent.pageX - gesture.dx,
        dx: gesture.dx,
        dy: gesture.dy,
        reservedEdge: reservedDrawerEdge,
      }),
    onPanResponderGrant: () => {
      setHidden(false);
      setDragging(true);
    },
    onPanResponderMove: (_event, gesture) => {
      const base = open ? size : 0;
      offset.set(Math.max(0, Math.min(size, base + gesture.dx)));
    },
    onPanResponderRelease: (_event, gesture) => {
      const next = settlesOpen({
        open,
        dx: gesture.dx,
        vx: gesture.vx,
        width: size,
      });
      setDragging(false);
      slide(next);
      if (next !== open) onOpenChange(next);
    },
    onPanResponderTerminate: () => {
      setDragging(false);
      slide(open);
    },
  });
  const content = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.get() }],
  }));
  const scrim = useAnimatedStyle(() => ({
    opacity: (offset.get() / Math.max(1, size)) * 0.35,
  }));
  return (
    <View className="flex-1 bg-background" collapsable={false}>
      <View
        className="absolute top-0 bottom-0 left-0"
        style={{
          width: size,
          display: hidden && !dragging && !open ? 'none' : 'flex',
        }}
        pointerEvents={open ? 'auto' : 'none'}
        accessibilityElementsHidden={!open}
        importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
        collapsable={false}
      >
        {panel}
      </View>
      <Animated.View
        className="flex-1 overflow-hidden bg-background"
        style={content}
        collapsable={false}
        {...responder.panHandlers}
      >
        <View
          className="flex-1"
          collapsable={false}
          pointerEvents={open ? 'none' : 'auto'}
          accessibilityElementsHidden={open}
          importantForAccessibility={open ? 'no-hide-descendants' : 'auto'}
        >
          {children}
        </View>
        <Animated.View
          className="absolute inset-0 bg-black"
          style={scrim}
          pointerEvents={open ? 'auto' : 'none'}
        >
          <Pressable
            className="flex-1"
            accessibilityRole="button"
            accessibilityLabel="Close worktrees"
            onPress={() => onOpenChange(false)}
          />
        </Animated.View>
      </Animated.View>
    </View>
  );
}
