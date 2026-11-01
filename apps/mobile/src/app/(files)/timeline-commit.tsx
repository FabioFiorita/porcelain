import { CommitScreen } from '../../features/history';
import { DestinationScreen } from '../../shell/destination-screen';

export default function TimelineCommitRoute() {
  return (
    <DestinationScreen>
      <CommitScreen diffRoute="/timeline-diff" returnTo="Files" />
    </DestinationScreen>
  );
}
