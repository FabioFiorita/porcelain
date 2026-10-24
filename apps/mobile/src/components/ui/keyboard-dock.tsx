import { KeyboardAvoidingView } from 'react-native';
import { useHeaderHeight } from 'expo-router/react-navigation';
import type { ReactNode } from 'react';

export function KeyboardDock({ children }: { children: ReactNode }) {
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
