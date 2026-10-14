import { useLocalSearchParams } from 'expo-router';
import { FileScreen } from '../../features/files';
import { DestinationScreen } from '../../shell/destination-screen';

export default function FileRoute() {
  const { path = '', workspace = '' } = useLocalSearchParams<{
    path?: string;
    workspace?: string;
  }>();
  return (
    <DestinationScreen>
      <FileScreen path={path} workspace={workspace} />
    </DestinationScreen>
  );
}
