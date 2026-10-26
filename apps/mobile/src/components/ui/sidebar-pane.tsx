import { type ReactNode } from 'react';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { Box } from './box';

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
  const style = useAnimatedStyle(() => {
    const target = visible ? width : 0;
    return {
      width: reduceMotion
        ? target
        : withTiming(target, {
            duration: 200,
            easing: Easing.bezier(0.23, 1, 0.32, 1),
            reduceMotion: ReduceMotion.Never,
          }),
    };
  });
  return (
    <Animated.View
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
