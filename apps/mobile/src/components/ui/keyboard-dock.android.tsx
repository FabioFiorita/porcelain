import { View } from 'react-native';
import type { KeyboardDockProps } from './keyboard-dock-props';

export function KeyboardDock({ children }: KeyboardDockProps) {
  return <View className="flex-1">{children}</View>;
}
