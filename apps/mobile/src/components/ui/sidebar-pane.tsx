import type { View } from 'react-native';
import { type ReactNode, type ComponentRef } from 'react';
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Box } from './box';
import { transitionSidebar } from '../../shared/rules/sidebar-transition';

export function SidebarPane({
  visible,
  compact,
  children,
  reduceMotion,
}: {
  visible: boolean;
  compact: boolean;
  children: ReactNode;
  reduceMotion: boolean;
}) {
  const width = compact ? 192 : 256;
  const extent = useSharedValue(visible ? width : 0);
  const style = useAnimatedStyle(() => ({ width: extent.get() }));
  return (
    <Animated.View
      ref={(element: ComponentRef<typeof View> | null) => {
        if (!element) return;
        transitionSidebar(
          {
            stop: () => cancelAnimation(extent),
            settle: (target) => extent.set(target),
            animate: (target) =>
              extent.set(
                withTiming(target, {
                  duration: 200,
                  easing: Easing.bezier(0.23, 1, 0.32, 1),
                  reduceMotion: ReduceMotion.Never,
                }),
              ),
          },
          visible,
          width,
          reduceMotion,
        );
        return () => cancelAnimation(extent);
      }}
      className="shrink-0 overflow-hidden"
      style={style}
      pointerEvents={visible ? 'auto' : 'none'}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
    >
      <Box className={`${compact ? 'w-48' : 'w-64'} flex-1`}>{children}</Box>
    </Animated.View>
  );
}
