import { TabletWorkspace } from '../../shell/tablet-workspace';
import { isTablet } from '../../shared/navigation/is-tablet';
import { FilesScreen } from '../../features/files';
import { DestinationScreen } from '../../shell/destination-screen';
import { useRouter } from 'expo-router';
import { useAppSidebar } from '../../features/preferences';

function FilesRoute() {
  const router = useRouter();
  const { sidebar } = useAppSidebar();
  if (isTablet) return <TabletWorkspace initialMode="files" />;
  return (
    <DestinationScreen>
      <FilesScreen
        sidebar={sidebar}
        onOpen={(path, workspace) =>
          router.push({ pathname: '/file', params: { path, workspace } })
        }
        onOpenTimeline={(path, workspace) =>
          router.push({ pathname: '/timeline', params: { path, workspace } })
        }
      />
    </DestinationScreen>
  );
}

export { FilesRoute as default };
