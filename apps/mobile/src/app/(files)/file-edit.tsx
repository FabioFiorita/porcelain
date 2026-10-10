import { useLocalSearchParams, useRouter } from 'expo-router';
import { FileScreen } from '../../features/files';

export default function FileEditRoute() {
  const { path = '', workspace = '' } = useLocalSearchParams<{
    path?: string;
    workspace?: string;
  }>();
  const router = useRouter();
  return (
    <FileScreen
      path={path}
      workspace={workspace}
      onDone={() => router.back()}
    />
  );
}
