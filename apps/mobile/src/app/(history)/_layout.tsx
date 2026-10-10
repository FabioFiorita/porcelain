import { Stack } from 'expo-router';
import { DestinationLayout } from '../../shell/destination-layout';

function HistoryLayout() {
  return (
    <DestinationLayout name="history" title="History">
      <Stack.Screen
        name="history/commit/[oid]/index"
        options={{ title: 'Commit' }}
      />
      <Stack.Screen
        name="history/commit/[oid]/diff"
        options={{ title: 'Diff' }}
      />
    </DestinationLayout>
  );
}

export { HistoryLayout as default };
