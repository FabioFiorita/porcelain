import { Text, View } from 'react-native';
import { useResolveClassNames } from 'uniwind';
import { worktreeLabel } from '@porcelain/client/projects/rules';
import { Button } from '../../../shared/ui/button';
import type { useCommit } from '../queries/commit';

export function CommitMetadata({
  data,
  parent,
  onParent,
}: {
  data: NonNullable<ReturnType<typeof useCommit>['data']>;
  parent: number;
  onParent: (parent: number) => void;
}) {
  const card = useResolveClassNames(
    'mx-4 mt-3 gap-3 rounded-xl border border-border bg-background px-4 py-3',
  );
  const title = useResolveClassNames('text-sm font-semibold text-foreground');
  const body = useResolveClassNames('text-sm leading-6 text-foreground');
  const caption = useResolveClassNames('text-xs text-muted-foreground');
  const oid = useResolveClassNames('font-mono text-xs text-muted-foreground');
  const refs = useResolveClassNames('flex-row flex-wrap gap-1.5');
  const badge = useResolveClassNames('rounded-md bg-secondary px-2 py-0.5');
  const ref = useResolveClassNames('text-xs text-secondary-foreground');
  const parents = useResolveClassNames('gap-2');
  const choices = useResolveClassNames(
    'flex-row flex-wrap gap-1 rounded-lg bg-muted p-1',
  );
  return (
    <View style={card}>
      <Text accessibilityRole="header" selectable style={title}>
        {data.commit.subject}
      </Text>
      {data.commit.body ? (
        <Text selectable style={body}>
          {data.commit.body}
        </Text>
      ) : null}
      {data.commit.subjectTruncated || data.commit.bodyTruncated ? (
        <Text style={caption}>Commit message truncated</Text>
      ) : null}
      <Text style={caption}>
        {data.commit.author.name} · {data.commit.author.timestamp}
      </Text>
      <Text selectable style={oid}>
        {data.commit.oid}
      </Text>
      <Text style={caption}>
        {data.comparison.kind === 'empty-tree'
          ? 'Root commit'
          : `Against parent ${data.comparison.parentNumber} · ${data.comparison.baseOid.slice(0, 7)}`}
      </Text>
      {data.commit.refs.length > 0 ? (
        <View style={refs}>
          {data.commit.refs.map((name) => (
            <View key={name} style={badge}>
              <Text style={ref}>{worktreeLabel(name)}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {data.commit.parentOids.length > 1 ? (
        <View style={parents}>
          <Text accessibilityRole="header" style={caption}>
            Compare with parent
          </Text>
          <View style={choices}>
            {data.commit.parentOids.map((parentOid, index) => (
              <Button
                key={parentOid}
                label={`Parent ${index + 1} · ${parentOid.slice(0, 7)}`}
                variant="ghost"
                size="sm"
                selected={parent === index + 1}
                onPress={() => onParent(index + 1)}
              />
            ))}
          </View>
        </View>
      ) : null}
      {data.files.length === 0 ? (
        <Text style={caption}>No files changed in this commit.</Text>
      ) : null}
    </View>
  );
}
