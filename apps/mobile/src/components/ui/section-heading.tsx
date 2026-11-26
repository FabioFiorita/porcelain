import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Text } from './text';

export function SectionHeading({
  label,
  trailing,
}: {
  label: string;
  trailing?: ReactNode;
}) {
  return (
    <View className="min-h-7 flex-row flex-wrap items-center gap-x-2 gap-y-1 border-b border-border pb-1.5">
      <Text
        variant="caption"
        weight="medium"
        tone="muted"
        accessibilityRole="header"
        className="flex-1"
      >
        {label}
      </Text>
      {trailing}
    </View>
  );
}
