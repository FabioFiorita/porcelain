import type { ReactNode } from 'react';
import { View } from 'react-native';

const placements = { top: 'top-2', bottom: 'bottom-4' };

export function FloatingBar({
  placement = 'bottom',
  action,
  testID,
  children,
}: {
  placement?: keyof typeof placements;
  action?: ReactNode;
  testID?: string;
  children: ReactNode;
}) {
  return (
    <View
      testID={testID}
      className={`absolute inset-x-0 z-40 items-center px-4 ${placements[placement]}`}
      pointerEvents="box-none"
    >
      <View
        className={`max-w-full flex-row flex-wrap items-center justify-center gap-3 rounded-3xl border border-border bg-popover py-1.5 pl-4 shadow-sm ${action ? 'pr-1.5' : 'pr-4'}`}
      >
        {children}
        {action}
      </View>
    </View>
  );
}
