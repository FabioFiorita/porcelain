import { useLocalSearchParams } from 'expo-router';
import { FilesScreen } from '../../../features/files';

export default function FilesRoute() {
  const { workspace } = useLocalSearchParams<{ workspace?: string }>();
  return <FilesScreen search="top-bar" workspace={workspace} />;
}
