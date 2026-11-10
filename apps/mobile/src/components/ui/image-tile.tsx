import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

export function ImageTile({
  image,
  caption,
  accessibilityLabel,
  onPress,
}: {
  image: ReactNode;
  caption: ReactNode;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      className="w-36 gap-1.5 active:opacity-70"
    >
      <View
        className="h-56 w-36 overflow-hidden rounded-lg border border-border bg-muted"
        collapsable={false}
      >
        {image}
      </View>
      {caption}
    </Pressable>
  );
}
