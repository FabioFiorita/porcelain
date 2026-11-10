import { useLocalSearchParams } from 'expo-router';
import { FilesScreen } from '../../../features/files';

export default function FilesRoute() {
  const { workspace } = useLocalSearchParams<{ workspace?: string }>();
  return <FilesScreen mode="stack" workspace={workspace} />;
}
