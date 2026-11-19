import { ActivityIndicator } from 'react-native';
import Animated from 'react-native-reanimated';

const appear = {
  animationName: { from: { opacity: 0 }, to: { opacity: 1 } },
  animationDuration: '150ms',
  animationDelay: '400ms',
  animationFillMode: 'backwards',
} as const;

export function Spinner() {
  return (
    <Animated.View
      testID="spinner"
      accessibilityState={{ busy: true }}
      className="grow items-center justify-center py-4"
      style={appear}
    >
      <ActivityIndicator
        size="small"
        colorClassName="accent-muted-foreground"
      />
    </Animated.View>
  );
}
