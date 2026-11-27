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
    <div className="flex h-svh w-full bg-frame p-2 max-md:p-0">
      <div className="grid min-w-0 flex-1 place-items-center rounded-paper border bg-card max-md:rounded-none max-md:border-0 [&>[data-slot=state-notice]]:justify-center">
        <StateFailure
          description="Could not display the workspace."
          onRetry={retry}
        />
      </div>
    </div>
  );
}
