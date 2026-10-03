import { SettingsScreen } from '../../features/access';
import { useForgetProjectEnvironment } from '../../features/projects';
import { DestinationScreen } from '../../shell/destination-screen';

function SettingsRoute() {
  const forgetProjectEnvironment = useForgetProjectEnvironment();
  return (
    <DestinationScreen>
      <SettingsScreen forgetProjectEnvironment={forgetProjectEnvironment} />
    </DestinationScreen>
  );
}

export { SettingsRoute as default };
