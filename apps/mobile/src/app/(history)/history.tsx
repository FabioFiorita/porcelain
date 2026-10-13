import { WorkspaceScreen } from '../../features/workspace';
import { isTablet } from '../../shared/navigation/is-tablet';
import { HistoryScreen } from '../../features/history';
import { DestinationScreen } from '../../shell/destination-screen';

function HistoryRoute() {
  if (isTablet) return <WorkspaceScreen initialMode="history" />;
  return (
    <DestinationScreen>
      <HistoryScreen />
    </DestinationScreen>
  );
}

export { HistoryRoute as default };
