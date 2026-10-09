import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
} from 'react-native';
const variants = {
  default: 'border-transparent bg-primary',
  secondary: 'border-transparent bg-secondary',
  outline: 'border-border bg-background active:bg-muted',
  ghost: 'border-transparent active:bg-muted',
  destructive: 'border-transparent bg-destructive/10 active:bg-destructive/20',
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
  default: 'min-h-11 min-w-11 px-4 py-2',
  sm: 'min-h-9 min-w-9 px-3 py-1.5',
  icon: 'h-11 w-11',
  iconSm: 'h-9 w-9',
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
};
export function ButtonSurface({
  children,
  variant = 'default',
  size = 'default',
  disabled = false,
  pending = false,
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
      accessibilityState={{ disabled: unavailable, busy: pending }}
      disabled={unavailable}
      hitSlop={hitSlop}
      className={[
        'flex-row items-center justify-center gap-2 rounded-2xl border active:opacity-80 disabled:opacity-50 focus:border-ring',
        variants[variant],
        sizes[size],
        className,
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
    </Pressable>
  );
}
