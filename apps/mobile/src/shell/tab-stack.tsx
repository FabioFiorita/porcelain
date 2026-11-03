import { Stack } from 'expo-router';

export function TabStack({ segment }: { segment: string }) {
  return (
    <Stack
      screenOptions={({ theme }) => ({
        headerBackButtonDisplayMode: 'minimal',
        headerLargeTitleEnabled: false,
        headerTintColor: theme.colors.text,
      })}
    >
      {segment === '(reviews)' ? (
        <Stack.Screen
          name="index"
          options={{ title: 'Reviews', headerLargeTitleEnabled: true }}
        />
      ) : (
        <Stack.Screen
          name="worktrees"
          options={{ title: 'Worktrees', headerLargeTitleEnabled: true }}
        />
      )}
      {segment === '(worktrees)' ? (
        <Stack.Screen name="worktree" options={{ title: '' }} />
      ) : null}
      <Stack.Screen name="review" options={{ title: 'Review' }} />
      <Stack.Screen name="files" options={{ title: 'Files' }} />
      <Stack.Screen name="history" options={{ title: 'History' }} />
      <Stack.Screen
        name="open/reviews/[reviewId]"
        options={{ title: 'Published review' }}
      />
      <Stack.Screen
        name="reviews/[reviewId]"
        options={{ title: 'Published review' }}
      />
      <Stack.Screen name="review-file" options={{ title: 'Changed file' }} />
      <Stack.Screen
        name="history/commit/[oid]/index"
        options={{ title: 'Commit' }}
      />
      <Stack.Screen
        name="history/commit/[oid]/diff"
        options={{ title: 'Diff' }}
      />
    </Stack>
  );
}
