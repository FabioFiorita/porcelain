import { Context, type Effect } from 'effect';
import type { ConnectionError } from '../../../shared/api/connection-error.ts';
import type { WriteNotSentError } from '../../../shared/api/write-queue.ts';

export class WorkspaceSelectionCleanup extends Context.Service<
  WorkspaceSelectionCleanup,
  {
    readonly forgetEnvironment: (
      environmentId: string,
    ) => Effect.Effect<void, ConnectionError | WriteNotSentError>;
  }
>()('@porcelain/client/WorkspaceSelectionCleanup') {}
