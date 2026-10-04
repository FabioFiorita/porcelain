import { useState, type ReactNode } from 'react';
import { Pressable, Text } from 'react-native';
import { useResolveClassNames } from 'uniwind';

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

const pressedBackgrounds: Record<ButtonVariant, string> = {
  default: 'bg-primary/80',
  outline: 'bg-muted dark:bg-input/30',
  secondary: 'bg-secondary opacity-80',
  ghost: 'bg-muted dark:bg-muted/50',
  destructive: 'bg-destructive/20 dark:bg-destructive/30',
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
  const [focused, setFocused] = useState(false);
  const baseStyle = useResolveClassNames(
    `min-w-0 shrink-0 border ${sizes[size]} ${backgrounds[variant]}`,
  );
  const selectedStyle = useResolveClassNames('bg-accent');
  const selectedPressedStyle = useResolveClassNames('opacity-80');
  const pressedStyle = useResolveClassNames(pressedBackgrounds[variant]);
  const focusedStyle = useResolveClassNames(
    variant === 'destructive' ? 'border-destructive/40' : 'border-ring',
  );
  const disabledStyle = useResolveClassNames('opacity-50');
  const labelStyle = useResolveClassNames(
    `text-sm font-medium ${size === 'row' ? 'text-left' : 'text-center'} ${selected ? 'text-accent-foreground' : foregrounds[variant]}`,
  );

  return (
    <Pressable
      accessible
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled, selected }}
      testID={testID}
      disabled={disabled}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [
        baseStyle,
        selected && selectedStyle,
        pressed &&
          !disabled &&
          (selected ? selectedPressedStyle : pressedStyle),
        focused && !disabled && focusedStyle,
        disabled && disabledStyle,
      ]}
    >
      {children ?? <Text style={labelStyle}>{label}</Text>}
    </Pressable>
  );
}
