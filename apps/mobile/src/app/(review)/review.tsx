import { TabletWorkspace } from '../../shell/tablet-workspace';
import { isTablet } from '../../shared/navigation/is-tablet';
import { ReviewScreen } from '../../features/reviews';
import { DestinationScreen } from '../../shell/destination-screen';

function ReviewRoute() {
  if (isTablet) return <TabletWorkspace initialMode="review" />;
  return (
    <DestinationScreen>
      <ReviewScreen />
    </DestinationScreen>
  );
}

export { ReviewRoute as default };
