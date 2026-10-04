import { Text, View } from 'react-native';
import { useResolveClassNames } from 'uniwind';
import { worktreeLabel } from '@porcelain/client/projects/rules';
import { Button } from '../../../shared/ui/button';
import type { useHistory } from '../queries/history';

export function HistoryRow({
  commit,
  onOpen,
}: {
  commit: NonNullable<ReturnType<typeof useHistory>['data']>['commits'][number];
  onOpen: () => void;
}) {
  const inset = useResolveClassNames('px-2 py-0.5');
  const content = useResolveClassNames('min-w-0 flex-1 gap-1');
  const line = useResolveClassNames('flex-row flex-wrap items-center gap-1.5');
  const subject = useResolveClassNames(
    'min-w-0 flex-1 text-sm leading-5 font-medium text-foreground',
  );
  const caption = useResolveClassNames('text-xs text-muted-foreground');
  const oid = useResolveClassNames('font-mono text-xs text-muted-foreground');
  const badge = useResolveClassNames('rounded-md bg-secondary px-2 py-0.5');
  const ref = useResolveClassNames('text-xs text-secondary-foreground');
  return (
    <View style={inset}>
      <Button
        label={commit.subject}
        accessibilityLabel={`${commit.subject}, ${commit.oid.slice(0, 7)}, ${commit.author.name}, ${commit.author.timestamp}`}
        testID={`history-commit-${commit.oid}`}
        variant="ghost"
        size="row"
        onPress={onOpen}
      >
        <View style={content}>
          <View style={line}>
            <Text numberOfLines={2} style={subject}>
              {commit.subject}
            </Text>
            {commit.parentOids.length > 1 ? (
              <Text style={caption}>Merge commit</Text>
            ) : null}
          </View>
          <View style={line}>
            <Text style={oid}>{commit.oid.slice(0, 7)}</Text>
            <Text style={caption}>{commit.author.name}</Text>
            <Text style={caption}>· {commit.author.timestamp}</Text>
          </View>
          {commit.refs.length > 0 ? (
            <View style={line}>
              {commit.refs.map((name) => (
                <View key={name} style={badge}>
                  <Text numberOfLines={1} style={ref}>
                    {worktreeLabel(name)}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </Button>
    </View>
  );
}
