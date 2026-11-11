import { Stack, useRouter } from 'expo-router';
import { View } from 'react-native';
import { headerIcon } from '../../shared/icons/header-icon';
import { SheetBody } from './sheet-body';
import { sheetDetents, type SheetProps, type SheetSize } from './sheet-props';

export function sheetOptions(size: SheetSize) {
  return {
    presentation: 'formSheet' as const,
    headerShown: true,
    sheetAllowedDetents: sheetDetents[size],
    sheetGrabberVisible: true,
  };
}

export function Sheet({ title, layout = 'scroll', children }: SheetProps) {
  const router = useRouter();
  return (
    <View className="flex-1 bg-background" collapsable={false}>
      <Stack.Screen
        options={{
          title,
          headerBackButtonMenuEnabled: false,
          ...(layout === 'fixed' ? { headerTransparent: false } : {}),
        }}
      />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon={headerIcon('close')}
          accessibilityLabel="Close"
          onPress={() => router.back()}
        />
      </Stack.Toolbar>
      <SheetBody layout={layout}>{children}</SheetBody>
    </View>
  );
}

export const guardedSheetOptions = sheetOptions('tall');

export { Sheet as GuardedSheet };
