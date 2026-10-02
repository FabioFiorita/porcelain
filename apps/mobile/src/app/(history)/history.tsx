import { HistoryScreen } from '../../features/history';
import { DestinationScreen } from '../../shell/destination-screen';

function HistoryRoute() {
  return (
    <DestinationScreen>
      <HistoryScreen />
    </DestinationScreen>
  );
}

export { HistoryRoute as default };
