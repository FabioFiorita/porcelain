import { FileTimelineScreen } from '../../features/history';
import { DestinationScreen } from '../../shell/destination-screen';

export default function TimelineRoute() {
  return (
    <DestinationScreen>
      <FileTimelineScreen />
    </DestinationScreen>
  );
}
