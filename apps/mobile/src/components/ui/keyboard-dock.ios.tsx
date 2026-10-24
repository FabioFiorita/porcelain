import { KeyboardAvoidingView } from 'react-native';
import { useHeaderHeight } from 'expo-router/react-navigation';
import type { KeyboardDockProps } from './keyboard-dock-props';

export function KeyboardDock({ children }: KeyboardDockProps) {
  return (
    <KeyboardAvoidingView
      behavior="padding"
      keyboardVerticalOffset={useHeaderHeight()}
      className="flex-1"
    >
      {children}
    </KeyboardAvoidingView>
  );
}
