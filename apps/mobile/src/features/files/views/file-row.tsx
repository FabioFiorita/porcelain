import { Text, View } from 'react-native';
import { useResolveClassNames } from 'uniwind';

export function FileRow({
  name,
  detail,
  expanded,
}: {
  name: string;
  detail?: string;
  expanded?: boolean;
}) {
  const row = useResolveClassNames('flex-1 flex-row items-center gap-3');
  const disclosure = useResolveClassNames(
    'w-4 text-center text-base text-muted-foreground',
  );
  const content = useResolveClassNames('min-w-0 flex-1 gap-1');
  const title = useResolveClassNames(
    expanded === undefined
      ? 'text-sm text-foreground'
      : 'text-sm font-medium text-foreground',
  );
  const metadata = useResolveClassNames('text-xs text-muted-foreground');
  return (
    <View style={row}>
      <Text accessible={false} style={disclosure}>
        {expanded === undefined ? '·' : expanded ? '⌄' : '›'}
      </Text>
      <View style={content}>
        <Text numberOfLines={1} ellipsizeMode="middle" style={title}>
          {name}
        </Text>
        {detail ? (
          <Text numberOfLines={1} ellipsizeMode="middle" style={metadata}>
            {detail}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
