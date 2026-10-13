import { WorkspaceScreen } from '../../features/workspace';
import { isTablet } from '../../shared/navigation/is-tablet';
import { ReviewScreen } from '../../features/reviews';
import { DestinationScreen } from '../../shell/destination-screen';

function ReviewRoute() {
  if (isTablet) return <WorkspaceScreen initialMode="review" />;
  return (
    <DestinationScreen>
      <ReviewScreen />
    </DestinationScreen>
  );
}

export { ReviewRoute as default };
