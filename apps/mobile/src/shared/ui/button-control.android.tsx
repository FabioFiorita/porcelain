import { Host, RNHostView } from '@expo/ui';
import { Shape, TextButton } from '@expo/ui/jetpack-compose';
import {
  fillMaxWidth,
  selectable,
  semantics,
  testID as nativeTestID,
} from '@expo/ui/jetpack-compose/modifiers';
import type { ReactElement } from 'react';
import type { ColorValue } from 'react-native';
import { useResolveClassNames, useUniwind } from 'uniwind';

export function ButtonControl({
  children,
  onPress,
  accessibilityLabel,
  testID,
  disabled,
  selected,
  row,
  color,
  radius,
}: {
  children: ReactElement;
  onPress: () => void;
  accessibilityLabel: string;
  testID?: string | undefined;
  disabled: boolean;
  selected: boolean;
  row: boolean;
  color?: ColorValue | undefined;
  radius?: number | undefined;
}) {
  const { theme } = useUniwind();
  const hostStyle = useResolveClassNames(row ? 'w-full' : 'self-start');
  function press() {
    if (!disabled) onPress();
  }
  return (
    <Host
      matchContents={{ vertical: true, horizontal: !row }}
      style={hostStyle}
      colorScheme={theme === 'dark' ? 'dark' : 'light'}
      {...(color === undefined ? {} : { seedColor: color })}
    >
      <TextButton
        enabled={!disabled}
        onClick={press}
        contentPadding={{
          start: 0,
          top: 0,
          end: 0,
          bottom: 0,
        }}
        colors={{
          containerColor: 'transparent',
          disabledContainerColor: 'transparent',
          ...(color === undefined
            ? {}
            : { contentColor: color, disabledContentColor: color }),
        }}
        {...(radius === undefined
          ? {}
          : {
              shape: Shape.RoundedCorner({
                cornerRadii: {
                  topStart: radius,
                  topEnd: radius,
                  bottomStart: radius,
                  bottomEnd: radius,
                },
              }),
            })}
        modifiers={[
          semantics({ contentDescription: accessibilityLabel }),
          selectable(selected, press),
          ...(row ? [fillMaxWidth()] : []),
          ...(testID === undefined ? [] : [nativeTestID(testID)]),
        ]}
      >
        <RNHostView matchContents>{children}</RNHostView>
      </TextButton>
    </Host>
  );
}
