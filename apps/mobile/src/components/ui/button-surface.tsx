import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  View,
  type PressableProps,
} from 'react-native';
const variants = {
  default: 'border-transparent bg-primary',
  secondary: 'border-transparent bg-secondary',
  outline: 'border-border dark:bg-input/30',
  ghost: 'border-transparent',
  destructive: 'border-transparent bg-destructive/10 dark:bg-destructive/20',
  link: 'border-transparent',
};
export const buttonTones = {
  default: 'primaryForeground',
  secondary: 'secondaryForeground',
  outline: 'default',
  ghost: 'default',
  destructive: 'destructive',
  link: 'primary',
} as const;
const indicatorTones = {
  default: 'accent-primary-foreground',
  secondary: 'accent-secondary-foreground',
  outline: 'accent-foreground',
  ghost: 'accent-foreground',
  destructive: 'accent-destructive',
  link: 'accent-primary',
};
const sizes = {
  default: 'min-h-9 px-3 py-1.5',
  sm: 'min-h-8 px-2.5 py-1',
  icon: 'min-h-9 w-9',
  iconSm: 'min-h-8 w-8',
  navigatorGroup: 'min-h-9 min-w-9 gap-2 rounded-md px-2 py-0',
  navigatorPhoneGroup: 'min-h-9 min-w-9 gap-1.5 rounded-md px-1.5 py-0',
};
export type ButtonSurfaceProps = Omit<
  PressableProps,
  | 'children'
  | 'style'
  | 'accessibilityRole'
  | 'accessibilityState'
  | 'disabled'
  | 'onPress'
  | 'accessibilityLabel'
> & {
  children: ReactNode;
  accessibilityLabel: string;
  onPress: NonNullable<PressableProps['onPress']>;
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  disabled?: boolean;
  pending?: boolean;
  expanded?: boolean;
  align?: 'center' | 'start';
};
export function ButtonSurface({
  children,
  variant = 'default',
  size = 'default',
  disabled = false,
  pending = false,
  expanded,
  align = 'center',
  className,
  hitSlop = 4,
  ...props
}: ButtonSurfaceProps) {
  const unavailable = disabled || pending;
  return (
    <Pressable
      {...props}
      accessible
      accessibilityRole="button"
      accessibilityState={{ disabled: unavailable, busy: pending, expanded }}
      disabled={unavailable}
      hitSlop={hitSlop}
      className={[
        'min-h-11 min-w-11 items-center justify-center rounded-md border border-transparent focus:border-ring disabled:opacity-50',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {({ pressed }) => (
        <View
          className={[
            'flex-row items-center gap-2 rounded-md border',
            align === 'start' ? 'justify-start' : 'justify-center',
            size === 'icon' || size === 'iconSm' ? '' : 'self-stretch',
            variants[variant],
            sizes[size],
            pressed ? 'opacity-80' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {pending ? (
            <ActivityIndicator
              accessible={false}
              size="small"
              colorClassName={indicatorTones[variant]}
            />
          ) : null}
          {children}
        </View>
      )}
    </Pressable>
  );
}
