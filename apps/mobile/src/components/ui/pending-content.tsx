import type { ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';

export function PendingContent({
  pending,
  colorClassName = 'accent-foreground',
  children,
}: {
  pending: boolean;
  colorClassName?: string;
  children: ReactNode;
}) {
  return (
    <View className="relative min-w-0 shrink flex-row items-center justify-center">
      <View className={pending ? 'min-w-0 shrink opacity-0' : 'min-w-0 shrink'}>
        {children}
      </View>
      {pending ? (
        <View
          className="absolute inset-0 items-center justify-center"
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <ActivityIndicator
            accessible={false}
            size="small"
            colorClassName={colorClassName}
          />
        </View>
      ) : null}
    </View>
  );
}
