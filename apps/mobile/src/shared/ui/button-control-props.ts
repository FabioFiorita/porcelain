import type { ReactElement } from 'react';
import type { ColorValue } from 'react-native';

export type ButtonControlProps = {
  children: ReactElement;
  onPress: () => void;
  accessibilityLabel: string;
  testID?: string | undefined;
  disabled: boolean;
  selected: boolean;
  row: boolean;
  color?: ColorValue | undefined;
  radius?: number | undefined;
};
