import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-screens/experimental';
import { appTabs, type WorktreeTab } from './app-tab-list';

function rootOf(segment: string): WorktreeTab {
  return appTabs.find((tab) => tab.name === segment)?.root ?? 'walkthrough';
}

function TabRoutes({ root }: { root: WorktreeTab }) {
  return (
    <Stack
      screenOptions={({ theme }) => ({
        headerBackButtonDisplayMode: 'minimal',
        headerLargeTitleEnabled: false,
        headerTintColor: theme.colors.text,
      })}
    >
      <Stack.Screen name={root} options={{ title: '' }} />
      <Stack.Screen name="file" options={{ title: '' }} />
      <Stack.Screen name="review-file" options={{ title: 'Changed file' }} />
      <Stack.Screen name="review-changes" options={{ title: 'All changes' }} />
      <Stack.Screen name="walkthrough-step" options={{ title: 'Step' }} />
      <Stack.Screen name="pull-request" options={{ title: 'Pull request' }} />
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

export function TabStack({ segment }: { segment: string }) {
  return (
    <SafeAreaView edges={{ left: true, right: true }} style={{ flex: 1 }}>
      <TabRoutes root={rootOf(segment)} />
    </SafeAreaView>
  );
}
