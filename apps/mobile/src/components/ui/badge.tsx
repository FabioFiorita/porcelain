import { Pressable, View, type ViewProps } from 'react-native';
import { Icon, type IconName } from './icon';
import { Text } from './text';
const variants = {
  default: 'border-transparent bg-primary',
  secondary: 'border-transparent bg-secondary',
  outline: 'border-border bg-input/20 dark:bg-input/30',
  destructive: 'border-transparent bg-destructive/10 dark:bg-destructive/20',
  brand: 'border-transparent bg-brand',
  'brand-soft': 'border-transparent bg-brand-soft',
  open: 'border-transparent bg-add-bg',
  draft: 'border-transparent bg-muted',
  merged: 'border-transparent bg-brand-soft',
  closed: 'border-transparent bg-del-bg',
};
const tones = {
  default: 'primaryForeground',
  secondary: 'secondaryForeground',
  outline: 'default',
  destructive: 'destructive',
  brand: 'brandForeground',
  'brand-soft': 'brand',
  open: 'add',
  draft: 'muted',
  merged: 'brand',
  closed: 'del',
} as const;
export function Badge({
  label,
  labelNumberOfLines,
  icon,
  variant = 'default',
  className,
  onPress,
  ...props
}: Omit<ViewProps, 'style' | 'children'> & {
  label: string;
  labelNumberOfLines?: number;
  icon?: IconName;
  variant?: keyof typeof variants;
  onPress?: () => void;
}) {
  const classes = [
    'self-start rounded-full border px-2 py-0.5',
    icon && 'flex-row items-center gap-1',
    variants[variant],
    className,
  ]
    .filter(Boolean)
    .join(' ');
  const text = (
    <Text
      {...(onPress ? { accessible: false } : {})}
      numberOfLines={labelNumberOfLines}
      variant="badge"
      weight="medium"
      tone={tones[variant]}
      {...(icon ? { className: 'shrink' } : {})}
    >
      {label}
    </Text>
  );
  const content = icon ? (
    <>
      <Icon name={icon} size="tiny" tone={tones[variant]} />
      {text}
    </>
  ) : (
    text
  );
  if (onPress) {
    return (
      <Pressable
        {...props}
        accessible
        accessibilityRole="button"
        accessibilityLabel={props.accessibilityLabel ?? label}
        onPress={onPress}
        className="min-h-11 min-w-11 self-start justify-center"
      >
        <View className={classes}>{content}</View>
      </Pressable>
    );
  }
  return (
    <View {...props} className={classes}>
      {content}
    </View>
  );
}
