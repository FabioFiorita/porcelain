import { FilesScreen } from '../../features/files';
import { DestinationScreen } from '../../shell/destination-screen';
import { useRouter } from 'expo-router';

function FilesRoute() {
  const router = useRouter();
  return (
    <DestinationScreen>
      <FilesScreen
        onOpen={(path, workspace) =>
          router.push({ pathname: '/file', params: { path, workspace } })
        }
      />
    </DestinationScreen>
  );
}

export { FilesRoute as default };
