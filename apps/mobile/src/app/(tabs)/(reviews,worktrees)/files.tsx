import { useLocalSearchParams, useRouter } from 'expo-router';
import { FilesScreen } from '../../../features/files';

function FilesRoute() {
  const router = useRouter();
  const { workspace } = useLocalSearchParams<{ workspace?: string }>();
  return (
    <FilesScreen
      workspace={workspace}
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
