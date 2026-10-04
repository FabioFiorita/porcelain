import { Text, View } from 'react-native';
import { useSelectedWorktree } from '../../projects';
import { useReview } from '../queries/review';

export function ReviewContents() {
  const current = useSelectedWorktree();
  return (
    <View className="flex-1 bg-background px-6 py-8">
      {current ? (
        <SelectedContents
          key={current.key}
          scope={current.scope}
          connection={current.connection}
        />
      ) : (
        <Text className="text-sm leading-6 text-muted-foreground">
          No worktree selected.
        </Text>
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
  return (
    <View className="gap-3">
      <Text className="text-sm font-medium text-foreground">
        Uncommitted changes
      </Text>
      <Text className="text-sm leading-6 text-muted-foreground">
        {review.isPending
          ? 'Reading changes…'
          : review.error
            ? 'Could not read review.'
            : `${review.files.length} changed files`}
      </Text>
      <Text className="text-sm leading-6 text-muted-foreground">
        Choose a file in Review to read its diff.
      </Text>
    </View>
  );
}
