import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Text } from './text';
export function Field({
  label,
  description,
  error,
  children,
}: {
  label: string;
  description?: string;
  error?: string | undefined;
  children: ReactNode;
}) {
  return (
    <View className="gap-2">
      <Text variant="ui" weight="medium">
        {label}
      </Text>
      {children}
      {error ? (
        <Text variant="caption" tone="destructive" accessibilityRole="alert">
          {error}
        </Text>
      ) : description ? (
        <Text variant="caption" tone="muted">
          {description}
        </Text>
      ) : null}
    </View>
  );
}
