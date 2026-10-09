import { Text } from './text';

export function FilePath({
  path,
  compact = false,
}: {
  path: string;
  compact?: boolean;
}) {
  return (
    <Text
      variant="ui"
      selectable
      numberOfLines={compact ? 1 : undefined}
      ellipsizeMode="middle"
    >
      {path}
    </Text>
  );
}
