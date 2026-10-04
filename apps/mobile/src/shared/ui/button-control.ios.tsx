import { Button, Host, RNHostView } from '@expo/ui';
import { HStack } from '@expo/ui/swift-ui';
import {
  accessibilityAddTraits,
  accessibilityElement,
  accessibilityLabel as nativeAccessibilityLabel,
  contentShape,
  shapes,
} from '@expo/ui/swift-ui/modifiers';
import { useResolveClassNames, useUniwind } from 'uniwind';
import type { ButtonControlProps } from './button-control-props';

export function ButtonControl({
  children,
  onPress,
  accessibilityLabel,
  testID,
  disabled,
  selected,
  row,
  color,
}: ButtonControlProps) {
  const { theme } = useUniwind();
  const hostStyle = useResolveClassNames(row ? 'w-full' : 'self-start');
  return (
    <Host
      matchContents={{ vertical: true, horizontal: !row }}
      style={hostStyle}
      colorScheme={theme === 'dark' ? 'dark' : 'light'}
      {...(color === undefined ? {} : { seedColor: color })}
    >
      <Button
        variant="text"
        disabled={disabled}
        {...(testID === undefined ? {} : { testID })}
        onPress={() => {
          if (!disabled) onPress();
        }}
        modifiers={[
          accessibilityElement('ignore'),
          nativeAccessibilityLabel(accessibilityLabel),
          accessibilityAddTraits(
            selected ? ['isButton', 'isSelected'] : ['isButton'],
          ),
        ]}
      >
        <HStack modifiers={[contentShape(shapes.rectangle())]}>
          <RNHostView matchContents>{children}</RNHostView>
        </HStack>
      </Button>
    </Host>
  );
}
