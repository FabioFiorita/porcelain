import { type ErrorComponentProps, useRouter } from '@tanstack/react-router';
import { useWorkspaceRetry } from '@/features/access/index';
import { CloudOffIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StateNotice } from '@/components/state-notice';

export function WorkspaceError({ reset }: ErrorComponentProps) {
  const router = useRouter();
  const retry = () => {
    reset();
    void router.invalidate();
  };
  useWorkspaceRetry(retry);

  return (
    <StateNotice
      role="alert"
      icon={<CloudOffIcon />}
      title="Could not display the workspace"
      description="Porcelain will retry when the connection returns or this window becomes active again."
    >
      <Button variant="outline" onClick={retry}>
        Try again
      </Button>
    </StateNotice>
  );
}
