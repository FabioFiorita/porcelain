import { Stack } from 'expo-router';
import { useHistoryPresentation } from '../../features/history';
import { DestinationLayout } from '../../shell/destination-layout';
import { HistoryLayoutFrame } from '../../shell/history-layout';

export const unstable_settings = { anchor: 'history' };

function HistoryLayout() {
  const { wide } = useHistoryPresentation();
  return (
    <HistoryLayoutFrame>
      <DestinationLayout name="history" title="History" leadingSidebar={!wide}>
        <Stack.Screen
          name="history/commit/[oid]/index"
          options={{ title: 'Commit' }}
        />
        <Stack.Screen
          name="history/commit/[oid]/diff"
          options={{ title: 'Diff' }}
        />
      </DestinationLayout>
    </HistoryLayoutFrame>
  );
}

export { HistoryLayout as default };
