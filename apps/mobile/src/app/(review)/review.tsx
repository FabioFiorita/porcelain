import { ReviewScreen } from '../../features/reviews';
import { DestinationScreen } from '../../shell/destination-screen';

function ReviewRoute() {
  return (
    <DestinationScreen>
      <ReviewScreen />
    </DestinationScreen>
  );
}

export { ReviewRoute as default };
