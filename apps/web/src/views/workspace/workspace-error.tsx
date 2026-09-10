import { useRouter } from '@tanstack/react-router';
import { Button } from '../../components/ui/button';
import { useConnection } from '../../query/connection';

export function WorkspaceError() {
  const { disconnect, disconnectError, disconnectPending } = useConnection();
  const router = useRouter();
  return (
    <section role="alert" className="flex flex-col gap-3 p-6">
      <p>Could not display the workspace. Reconnect to try again.</p>
      {disconnectError && <p>{disconnectError.message}</p>}
      <Button
        disabled={disconnectPending}
        onClick={() => {
          void disconnect();
          void router.invalidate();
        }}
      >
        Reconnect
      </Button>
    </section>
  );
}
