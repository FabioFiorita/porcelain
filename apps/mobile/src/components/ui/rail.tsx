import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from './icon';
import { usePressRipple } from './press-ripple';
import { Text } from './text';

export function Rail({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      className="w-20 items-center gap-3 border-r border-border bg-background"
      style={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }}
      accessibilityRole="tablist"
      collapsable={false}
    >
      {children}
    </View>
  );
}

export function RailItem({
  icon,
  label,
  selected = false,
  onPress,
  testID,
}: {
  icon: IconName;
  label: string;
  selected?: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const ripple = usePressRipple('bounded');
  return (
    <Pressable
      {...(ripple ? { android_ripple: ripple } : {})}
      testID={testID}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      className="w-20 items-center gap-1 py-1"
    >
      <View
        className={`h-8 w-14 items-center justify-center rounded-full ${selected ? 'bg-muted' : ''}`}
      >
        <Icon name={icon} tone={selected ? 'default' : 'muted'} />
      </View>
      <Text
        variant="caption"
        weight={selected ? 'semibold' : 'medium'}
        tone={selected ? 'default' : 'muted'}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}
