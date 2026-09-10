import { Alert, AlertDescription } from '@/components/ui/alert';
import { useConnection } from '../query/connection';
import { useAutomaticPlaygroundConnection } from '../query/playground';

export function PlaygroundAutoConnect() {
  const failed = useAutomaticPlaygroundConnection();
  const { connected } = useConnection();
  return failed && !connected ? (
    <Alert>
      <AlertDescription>
        Automatic playground connection failed. Connect manually or retry from
        Playground Devtools.
      </AlertDescription>
    </Alert>
  ) : null;
}
