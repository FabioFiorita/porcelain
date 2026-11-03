import { useRouter } from 'expo-router';
import { FilesScreen } from '../../../features/files';

function FilesRoute() {
  const router = useRouter();
  return (
    <FilesScreen
      onOpen={(path, workspace) =>
        router.push({ pathname: '/file', params: { path, workspace } })
      }
      onOpenTimeline={(path, workspace) =>
        router.push({ pathname: '/timeline', params: { path, workspace } })
      }
    />
  );
}

export { FilesRoute as default };
