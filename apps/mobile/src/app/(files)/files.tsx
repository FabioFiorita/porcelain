import { FilesScreen } from '../../features/files';
import { DestinationScreen } from '../../shell/destination-screen';
import { useRouter } from 'expo-router';
import { useAppSidebar } from '../../features/preferences';

function FilesRoute() {
  const router = useRouter();
  const { sidebar } = useAppSidebar();
  return (
    <DestinationScreen>
      <FilesScreen
        sidebar={sidebar}
        onOpen={(path, workspace) =>
          router.push({ pathname: '/file', params: { path, workspace } })
        }
        onEdit={(path, workspace) =>
          router.push({ pathname: '/file-edit', params: { path, workspace } })
        }
      />
    </DestinationScreen>
  );
}

export { FilesRoute as default };
