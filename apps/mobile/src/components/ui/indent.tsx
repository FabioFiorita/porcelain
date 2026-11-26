import type { ReactNode } from 'react';
import { View } from 'react-native';

const kinds = {
  thread: 'gap-3 border-l border-border pl-3',
  detail: 'gap-1 pr-4 pb-2 pl-10',
};

export function Indent({
  kind,
  children,
}: {
  kind: keyof typeof kinds;
  children: ReactNode;
}) {
  return <View className={kinds[kind]}>{children}</View>;
}
