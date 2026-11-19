import { type ErrorComponentProps, useRouter } from '@tanstack/react-router';
import { useWorkspaceRetry } from '@/features/access/index';
import { StateFailure } from '@/shared/views/state-notice';

export function WorkspaceError({ reset }: ErrorComponentProps) {
  const router = useRouter();
  const retry = () => {
    reset();
    void router.invalidate();
  };
  useWorkspaceRetry(retry);

  return (
    <StateFailure
      description="Could not display the workspace."
      onRetry={retry}
    />
  );
}
