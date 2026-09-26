import type { ErrorComponentProps } from '@tanstack/react-router';
import { useWorkspaceRetry } from '../queries/workspace-retry';

export function WorkspaceError({ reset }: ErrorComponentProps) {
  useWorkspaceRetry(reset);

  return (
    <section role="alert" className="flex flex-col gap-3 p-6">
      <p>Could not display the workspace.</p>
      <p className="text-muted-foreground">
        Porcelain will retry when the connection returns or this window becomes
        active again.
      </p>
    </section>
  );
}
