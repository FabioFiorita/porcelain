import { useLocalSearchParams } from 'expo-router';
import { TopBar } from '../../../shell/top-bar';
import { HistoryScreen } from '../../../features/history';

export default function HistoryRoute() {
  const { workspace } = useLocalSearchParams<{ workspace?: string }>();
  return (
    <>
      <TopBar />
      <HistoryScreen workspace={workspace} />
    </>
  );
}
