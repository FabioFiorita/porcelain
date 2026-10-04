import { Text, View } from 'react-native';
import { useResolveClassNames } from 'uniwind';

type BadgeVariant = 'default' | 'secondary' | 'outline' | 'destructive';

const surfaceVariants: Record<BadgeVariant, string> = {
  default: 'border-transparent bg-primary',
  secondary: 'border-transparent bg-secondary',
  outline: 'border-border',
  destructive: 'border-transparent bg-destructive/10 dark:bg-destructive/20',
};

const textVariants: Record<BadgeVariant, string> = {
  default: 'text-primary-foreground',
  secondary: 'text-secondary-foreground',
  outline: 'text-foreground',
  destructive: 'text-destructive',
};

export function Badge({
  label,
  variant = 'secondary',
  accessibilityLabel,
  testID,
}: {
  label: string;
  variant?: BadgeVariant;
  accessibilityLabel?: string;
  testID?: string;
}) {
  const surface = useResolveClassNames(
    `max-w-full min-h-5 shrink-0 self-start items-center justify-center overflow-hidden rounded-2xl border px-2 py-0.5 ${surfaceVariants[variant]}`,
  );
  const text = useResolveClassNames(
    `text-xs leading-4 font-medium ${textVariants[variant]}`,
  );

  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel ?? label}
      testID={testID}
      style={surface}
    >
      <Text accessible={false} numberOfLines={1} style={text}>
        {label}
      </Text>
    </View>
  );
}
