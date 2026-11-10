import type { ReactNode } from 'react';
import { View } from 'react-native';

export function FloatingBar({ children }: { children: ReactNode }) {
  return (
    <View
      className="absolute inset-x-0 bottom-4 items-center px-4"
      pointerEvents="box-none"
    >
      <View className="max-w-full flex-row flex-wrap items-center justify-center gap-3 rounded-3xl border border-border bg-popover py-1.5 pr-1.5 pl-4 shadow-sm">
        {children}
      </View>
    </View>
  );
}
