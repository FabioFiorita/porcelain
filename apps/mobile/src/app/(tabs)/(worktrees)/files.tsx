import { useLocalSearchParams } from 'expo-router';
import { TopBar } from '../../../shell/top-bar';
import { FilesScreen } from '../../../features/files';

export default function FilesRoute() {
  const { workspace } = useLocalSearchParams<{ workspace?: string }>();
  return (
    <>
      <TopBar />
      <FilesScreen mode="stack" workspace={workspace} />
    </>
  );
}
