import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  FileActionSheet,
  fileFormAction,
  useOpenFileBeside,
} from '../features/files';

export default function FileActionRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    workspace?: string;
    opened?: string;
    kind?: string;
    entryKind?: string;
    folder?: string;
    path?: string;
  }>();
  const openBeside = useOpenFileBeside(params.workspace ?? '');
  return (
    <FileActionSheet
      workspace={params.workspace}
      action={fileFormAction(params)}
      onClose={() => router.back()}
      onCreated={(path, workspace) => {
        if (params.opened === 'beside' && workspace === params.workspace)
          openBeside(path);
        else router.push({ pathname: '/file', params: { path, workspace } });
      }}
    />
  );
}
