import { KeyboardAvoidingView } from 'react-native';
import type { KeyboardDockProps } from './keyboard-dock-props';

export function KeyboardDock({ children }: KeyboardDockProps) {
  return (
    <KeyboardAvoidingView behavior="padding" className="flex-1">
      {children}
    </KeyboardAvoidingView>
  );
}
