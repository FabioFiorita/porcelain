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
    <div className="flex h-svh w-full bg-frame p-2">
      <div className="grid min-w-0 flex-1 place-items-center rounded-paper border bg-card [&>[data-slot=state-notice]]:justify-center">
        <StateFailure
          description="Could not display the workspace."
          onRetry={retry}
        />
      </div>
    </div>
  );
}
