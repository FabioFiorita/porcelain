import { CommitDiffScreen } from '../../features/history';
import { DestinationScreen } from '../../shell/destination-screen';

export default function TimelineDiffRoute() {
  return (
    <DestinationScreen>
      <CommitDiffScreen returnTo="Files" />
    </DestinationScreen>
  );
}
