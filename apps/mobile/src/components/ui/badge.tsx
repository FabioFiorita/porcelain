import { Pressable, View, type ViewProps } from 'react-native';
import { Text } from './text';
const variants = {
  default: 'border-transparent bg-primary',
  secondary: 'border-transparent bg-secondary',
  outline: 'border-border',
  destructive: 'border-transparent bg-destructive/10',
};
const tones = {
  default: 'primaryForeground',
  secondary: 'secondaryForeground',
  outline: 'default',
  destructive: 'destructive',
} as const;
export function Badge({
  label,
  labelNumberOfLines,
  variant = 'default',
  className,
  onPress,
  ...props
}: Omit<ViewProps, 'style' | 'children'> & {
  label: string;
  labelNumberOfLines?: number;
  variant?: keyof typeof variants;
  onPress?: () => void;
}) {
  const classes = [
    'self-start rounded-2xl border px-2 py-0.5',
    variants[variant],
    className,
  ]
    .filter(Boolean)
    .join(' ');
  const content = (
    <Text
      {...(onPress ? { accessible: false } : {})}
      numberOfLines={labelNumberOfLines}
      variant="small"
      weight="medium"
      tone={tones[variant]}
    >
      {label}
    </Text>
  );
  if (onPress) {
    return (
      <Pressable
        {...props}
        accessible
        accessibilityRole="button"
        accessibilityLabel={props.accessibilityLabel ?? label}
        onPress={onPress}
        hitSlop={10}
        className={classes}
      >
        {content}
      </Pressable>
    );
  }
  return (
    <View {...props} className={classes}>
      {content}
    </View>
  );
}
