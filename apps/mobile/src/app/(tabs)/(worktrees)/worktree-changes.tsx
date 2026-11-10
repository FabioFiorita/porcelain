import { useLocalSearchParams } from 'expo-router';
import { Screen } from '../../../components/ui/screen';
import { WorktreeChangesPane } from '../../../shell/workspace-review-pane';

export default function WorktreeChangesRoute() {
  const { workspace } = useLocalSearchParams<{ workspace?: string }>();
  return (
    <Screen layout="fixed">
      <WorktreeChangesPane workspace={workspace} />
    </Screen>
  );
}
