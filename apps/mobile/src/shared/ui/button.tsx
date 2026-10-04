import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { useResolveClassNames } from 'uniwind';
import { ButtonControl } from './button-control';

type ButtonVariant =
  | 'default'
  | 'outline'
  | 'secondary'
  | 'ghost'
  | 'destructive';
type ButtonSize = 'default' | 'sm' | 'row';

const backgrounds: Record<ButtonVariant, string> = {
  default: 'border-transparent bg-primary',
  outline: 'border-border bg-background dark:bg-transparent',
  secondary: 'border-transparent bg-secondary',
  ghost: 'border-transparent bg-transparent',
  destructive: 'border-transparent bg-destructive/10 dark:bg-destructive/20',
};

const foregrounds: Record<ButtonVariant, string> = {
  default: 'text-primary-foreground',
  outline: 'text-foreground',
  secondary: 'text-secondary-foreground',
  ghost: 'text-foreground',
  destructive: 'text-destructive',
};

const sizes: Record<ButtonSize, string> = {
  default: 'min-h-[44px] rounded-2xl items-center justify-center px-3 py-2',
  sm: 'min-h-[44px] rounded-2xl items-center justify-center px-3 py-1.5',
  row: 'w-full min-h-[52px] flex-row items-center justify-start rounded-lg px-2 py-2',
};

export function Button({
  label,
  onPress,
  variant = 'default',
  size = 'default',
  disabled = false,
  selected = false,
  accessibilityLabel,
  testID,
  children,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  selected?: boolean;
  accessibilityLabel?: string;
  testID?: string;
  children?: ReactNode;
}) {
  const baseStyle = useResolveClassNames(
    `min-w-0 shrink-0 border ${sizes[size]} ${backgrounds[variant]}`,
  );
  const selectedStyle = useResolveClassNames('bg-accent');
  const disabledStyle = useResolveClassNames('opacity-50');
  const labelStyle = useResolveClassNames(
    `text-sm font-medium ${size === 'row' ? 'text-left' : 'text-center'} ${selected ? 'text-accent-foreground' : foregrounds[variant]}`,
  );

  return (
    <ButtonControl
      accessibilityLabel={accessibilityLabel ?? label}
      testID={testID}
      disabled={disabled}
      selected={selected}
      row={size === 'row'}
      color={labelStyle.color}
      radius={
        typeof baseStyle.borderRadius === 'number'
          ? baseStyle.borderRadius
          : undefined
      }
      onPress={onPress}
    >
      <View
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        style={[
          baseStyle,
          selected && selectedStyle,
          disabled && disabledStyle,
        ]}
      >
        {children ?? <Text style={labelStyle}>{label}</Text>}
      </View>
    </ButtonControl>
  );
}
