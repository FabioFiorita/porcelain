import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Text } from './text';

export function Message({
  align = 'start',
  author,
  children,
}: {
  align?: 'start' | 'end';
  author?: string | undefined;
  children: ReactNode;
}) {
  return (
    <View
      className={
        align === 'end' ? 'max-w-[88%] gap-1 self-end' : 'w-full gap-1.5'
      }
    >
      {author ? (
        <Text variant="secondary" weight="semibold">
          {author}
        </Text>
      ) : null}
      {align === 'end' ? (
        <View className="rounded-2xl bg-muted px-3.5 py-2.5">{children}</View>
      ) : (
        children
      )}
    </View>
  );
}
