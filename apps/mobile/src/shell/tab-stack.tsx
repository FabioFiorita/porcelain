import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-screens/experimental';

function TabRoutes() {
  return (
    <Stack
      screenOptions={({ theme }) => ({
        headerBackButtonDisplayMode: 'minimal',
        headerLargeTitleEnabled: false,
        headerTintColor: theme.colors.text,
      })}
    >
      <Stack.Screen
        name="worktrees"
        options={{ title: 'Worktrees', headerLargeTitleEnabled: true }}
      />
      <Stack.Screen name="worktree" options={{ title: '' }} />
      <Stack.Screen name="files" options={{ title: 'Files' }} />
      <Stack.Screen name="history" options={{ title: 'History' }} />
      <Stack.Screen name="review-file" options={{ title: 'Changed file' }} />
      <Stack.Screen name="review-changes" options={{ title: 'All changes' }} />
      <Stack.Screen name="walkthrough-step" options={{ title: 'Step' }} />
      <Stack.Screen name="worktree-changes" options={{ title: 'Changes' }} />
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

export function TabStack() {
  return (
    <SafeAreaView edges={{ left: true, right: true }} style={{ flex: 1 }}>
      <TabRoutes />
    </SafeAreaView>
  );
}
