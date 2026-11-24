import { useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FullWindowOverlay } from 'react-native-screens';
import { Text } from './text';

export function NotificationViewport({
  title,
  keyboard,
}: {
  title: string | undefined;
  keyboard: number | undefined;
}) {
  const { bottom } = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  if (!title) return null;
  const view = (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        bottom:
          (keyboard === undefined
            ? bottom
            : Math.max(bottom, height - keyboard)) + 16,
      }}
      className="absolute inset-x-0 z-50 items-center px-4"
    >
      <View className="max-w-md rounded-xl border border-border bg-popover px-4 py-3 shadow-md">
        <Text variant="secondary" weight="semibold">
          {title}
        </Text>
      </View>
    </View>
  );
  return process.env.EXPO_OS === 'ios' ? (
    <FullWindowOverlay unstable_accessibilityContainerViewIsModal={false}>
      {view}
    </FullWindowOverlay>
  ) : (
    view
  );
}
