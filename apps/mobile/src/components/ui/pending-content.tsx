import type { ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';

export function PendingContent({
  pending,
  colorClassName = 'accent-foreground',
  className = '',
  children,
}: {
  pending: boolean;
  colorClassName?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <View className="relative min-w-0 shrink flex-row items-center justify-center">
      <View
        className={`min-w-0 shrink flex-row items-center ${className} ${pending ? 'opacity-0' : ''}`}
      >
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
