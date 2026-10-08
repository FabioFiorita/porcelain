import { View, type ViewProps } from 'react-native';
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
  variant = 'default',
  className,
  ...props
}: Omit<ViewProps, 'style' | 'children'> & {
  label: string;
  variant?: keyof typeof variants;
}) {
  return (
    <View
      {...props}
      className={[
        'self-start rounded-2xl border px-2 py-0.5',
        variants[variant],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <Text variant="small" weight="medium" tone={tones[variant]}>
        {label}
      </Text>
    </View>
  );
}
