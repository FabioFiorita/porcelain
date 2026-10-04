import { Text, View } from 'react-native';
import { useResolveClassNames } from 'uniwind';
import { useSelectedWorktree } from '../../projects';
import { useReview } from '../queries/review';

export function ReviewContents() {
  const current = useSelectedWorktree();
  const surface = useResolveClassNames('flex-1 bg-background px-4 py-6');
  const text = useResolveClassNames('text-sm leading-6 text-muted-foreground');
  return (
    <View style={surface}>
      {current ? (
        <SelectedContents
          key={current.key}
          scope={current.scope}
          connection={current.connection}
        />
      ) : (
        <Text style={text}>No worktree selected.</Text>
      )}
    </View>
  );
}

function SelectedContents({
  scope,
  connection,
}: {
  scope: Parameters<typeof useReview>[0];
  connection: Parameters<typeof useReview>[1];
}) {
  const review = useReview(scope, connection, 'worktree');
  const section = useResolveClassNames('gap-3');
  const heading = useResolveClassNames('text-sm font-medium text-foreground');
  const text = useResolveClassNames('text-sm leading-6 text-muted-foreground');
  return (
    <View style={section}>
      <Text style={heading}>Uncommitted changes</Text>
      <Text style={text}>
        {review.isPending
          ? 'Reading changes…'
          : review.error
            ? 'Could not read review.'
            : `${review.files.length} changed files`}
      </Text>
      <Text style={text}>Choose a file in Review to read its diff.</Text>
    </View>
  );
}
