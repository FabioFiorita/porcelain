import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  View,
  type PressableProps,
} from 'react-native';
import { hitTarget } from './hit-target';
import { usePressRipple } from './press-ripple';
const variants = {
  filled: 'bg-brand',
  tonal: 'bg-foreground/10',
  plain: '',
  destructive: 'bg-destructive/10 dark:bg-destructive/20',
  destructivePlain: '',
};
export const buttonTones = {
  filled: 'brandForeground',
  tonal: 'default',
  plain: 'brand',
  destructive: 'destructive',
  destructivePlain: 'destructive',
} as const;
const indicatorTones = {
  filled: 'accent-brand-foreground',
  tonal: 'accent-foreground',
  plain: 'accent-brand',
  destructive: 'accent-destructive',
  destructivePlain: 'accent-destructive',
};
const sizes = {
  default: 'min-h-11 gap-2 px-5',
  sm: 'min-h-8 gap-1.5 px-3.5',
  icon: 'size-10',
  iconSm: 'size-8',
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
  | 'android_ripple'
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
  variant = 'filled',
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
  const icon = size === 'icon' || size === 'iconSm';
  const surface = variants[variant] !== '';
  const ripple = usePressRipple('glyph');
  return (
    <Pressable
      {...props}
      accessible
      accessibilityRole="button"
      accessibilityState={{ disabled: unavailable, busy: pending, expanded }}
      disabled={unavailable}
      hitSlop={hitSlop}
      {...(icon && !surface && ripple ? { android_ripple: ripple } : {})}
      className={[
        hitTarget,
        'items-center justify-center rounded-full border border-transparent focus:border-ring disabled:opacity-50',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {({ pressed }) => (
        <View
          className={[
            'flex-row items-center rounded-full',
            align === 'start' ? 'justify-start' : 'justify-center',
            icon ? '' : 'self-stretch',
            variants[variant],
            sizes[size],
            pressed ? (surface ? 'opacity-70' : 'opacity-50') : '',
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
