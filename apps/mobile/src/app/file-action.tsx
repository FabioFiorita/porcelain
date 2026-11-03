import { useLocalSearchParams, useRouter } from 'expo-router';
import { FileActionSheet, fileFormAction } from '../features/files';

export default function FileActionRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    workspace?: string;
    kind?: string;
    entryKind?: string;
    folder?: string;
    path?: string;
  }>();
  return (
    <FileActionSheet
      workspace={params.workspace}
      action={fileFormAction(params)}
      onClose={() => router.back()}
      onCreated={(path, workspace) =>
        router.push({ pathname: '/file', params: { path, workspace } })
      }
    />
  );
}
