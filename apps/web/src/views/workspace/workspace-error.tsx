import { useRouter } from '@tanstack/react-router';
import { Button } from '../../components/ui/button';
import { useConnection } from '../../query/connection';

export function WorkspaceError() {
  const { disconnect } = useConnection();
  const router = useRouter();
  return (
    <section role="alert" className="flex flex-col gap-3 p-6">
      <p>Could not display the workspace. Reconnect to try again.</p>
      <Button
        onClick={() => {
          disconnect();
          void router.invalidate();
        }}
      >
        Reconnect
      </Button>
    </section>
  );
}
