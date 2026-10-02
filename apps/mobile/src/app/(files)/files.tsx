import { FilesScreen } from '../../features/files';
import { DestinationScreen } from '../../shell/destination-screen';

function FilesRoute() {
  return (
    <DestinationScreen>
      <FilesScreen />
    </DestinationScreen>
  );
}

export { FilesRoute as default };
