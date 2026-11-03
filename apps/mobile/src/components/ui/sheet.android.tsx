import { Stack, useRouter } from 'expo-router';
import { View } from 'react-native';
import { IconButton } from './icon-button';
import { SheetBody } from './sheet-body';
import { sheetDetents, type SheetProps, type SheetSize } from './sheet-props';
import { Text } from './text';

export function sheetOptions(size: SheetSize) {
  return {
    presentation: 'formSheet' as const,
    sheetAllowedDetents: sheetDetents[size],
    sheetCornerRadius: 28,
  };
}

export function Sheet({ title, layout = 'scroll', children }: SheetProps) {
  const router = useRouter();
  return (
    <View className="flex-1 bg-background" collapsable={false}>
      <View className="items-center pt-3 pb-1" accessible={false}>
        <View className="h-1 w-8 rounded-full bg-muted-foreground/40" />
      </View>
      <View className="min-h-14 flex-row items-center gap-2 pl-6 pr-2">
        <View className="min-w-0 flex-1">
          <Text
            variant="title"
            weight="medium"
            numberOfLines={1}
            accessibilityRole="header"
          >
            {title}
          </Text>
        </View>
        <IconButton
          icon="close"
          accessibilityLabel="Close"
          onPress={() => router.back()}
        />
      </View>
      <SheetBody layout={layout}>{children}</SheetBody>
    </View>
  );
}

export const guardedSheetOptions = {
  presentation: 'card' as const,
  headerShown: true,
};

export function GuardedSheet({
  title,
  layout = 'scroll',
  children,
}: SheetProps) {
  return (
    <View className="flex-1 bg-background" collapsable={false}>
      <Stack.Screen options={{ title }} />
      <SheetBody layout={layout}>{children}</SheetBody>
    </View>
  );
}
