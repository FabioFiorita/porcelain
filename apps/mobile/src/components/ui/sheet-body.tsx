import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';

export function SheetBody({
  layout,
  children,
}: {
  layout: 'scroll' | 'fixed';
  children: ReactNode;
}) {
  if (layout === 'fixed')
    return (
      <View className="flex-1" collapsable={false}>
        {children}
      </View>
    );
  return (
    <ScrollView
      className="flex-1"
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="grow gap-4 px-6 pt-2 pb-8"
    >
      {children}
    </ScrollView>
  );
}
