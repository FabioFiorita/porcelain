import { useLocalSearchParams } from 'expo-router';
import { FileScreen } from '../../../features/files';

export default function FileRoute() {
  const { path = '', workspace = '' } = useLocalSearchParams<{
    path?: string;
    workspace?: string;
  }>();
  return <FileScreen path={path} workspace={workspace} />;
}
