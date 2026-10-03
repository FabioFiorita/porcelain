import { type WorktreeConnection } from '../../src/shared/api/connection.ts';
import { remoteTransport } from '../../src/shared/api/transport.ts';
import type { IsolatedServer } from '@porcelain/server/kit/isolated-server';
import type { Session } from '@porcelain/server/kit/session';
import { inventory } from '@porcelain/server/kit/reads';
import { readInventoryResponseSchema } from '@porcelain/contracts/projects';

export async function connection(server: IsolatedServer, session: Session) {
  const controller = new AbortController();
  const connected: WorktreeConnection = {
    environmentId: readInventoryResponseSchema.parse(await inventory(session))
      .environmentId,
    transport: remoteTransport(server.address, server.credential, fetch),
    request: (signal) => ({
      signal: signal
        ? AbortSignal.any([controller.signal, signal])
        : controller.signal,
    }),
  };
  return {
    connected,
    controller,
    scope: { projectId: session.projectId, worktreeId: session.worktreeId },
  };
}
