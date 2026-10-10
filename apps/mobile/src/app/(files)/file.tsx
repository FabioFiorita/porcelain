import { useLocalSearchParams, useRouter } from 'expo-router';
import { FileScreen } from '../../features/files';
import { DestinationScreen } from '../../shell/destination-screen';

export default function FileRoute() {
  const { path = '', workspace = '' } = useLocalSearchParams<{
    path?: string;
    workspace?: string;
  }>();
  const router = useRouter();
  return (
    <DestinationScreen>
      <FileScreen
        path={path}
        workspace={workspace}
        onEdit={() =>
          router.push({ pathname: '/file-edit', params: { path, workspace } })
        }
      />
    </DestinationScreen>
  );
}
