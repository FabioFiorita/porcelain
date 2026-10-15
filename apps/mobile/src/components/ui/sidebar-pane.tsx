import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Box } from './box';
import { Separator } from './separator';
import { transitionSidebar } from '../../shared/rules/sidebar-transition';

export function SidebarPane({
  visible,
  compact,
  children,
}: {
  visible: boolean;
  compact: boolean;
  children: ReactNode;
}) {
  const width = compact ? 192 : 256;
  const extent = useSharedValue(visible ? width : 0);
  const initialReduceMotion = useReducedMotion();
  const [reduceMotion, setReduceMotion] = useState(initialReduceMotion);
  useEffect(() => {
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );
    return () => subscription.remove();
  }, []);
  useEffect(() => {
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
  }, [extent, visible, width, reduceMotion]);
  const style = useAnimatedStyle(() => ({ width: extent.get() }));
  return (
    <Animated.View
      className="shrink-0 overflow-hidden"
      style={style}
      pointerEvents={visible ? 'auto' : 'none'}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
    >
      <Box className={`${compact ? 'w-48' : 'w-64'} flex-1 flex-row`}>
        <Box className="min-w-0 flex-1">{children}</Box>
        <Separator orientation="vertical" />
      </Box>
    </Animated.View>
  );
}
