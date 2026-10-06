import { Schema } from 'effect';
import { afterEach } from 'vitest';
import { createWorktreeConnection } from '../../src/shared/api/worktree-connection.ts';
import { remoteTransport } from '../../src/shared/api/transport.ts';
import type { IsolatedServer } from '@porcelain/server/kit/isolated-server';
import type { Session } from '@porcelain/server/kit/session';
import { inventory } from '@porcelain/server/kit/reads';
import { readInventoryResponseSchema } from '@porcelain/contracts/projects';

export async function connection(server: IsolatedServer, session: Session) {
  const lifetime = createWorktreeConnection({
    timeoutMs: 15_000,
    environmentId: Schema.decodeUnknownSync(readInventoryResponseSchema)(
      await inventory(session),
    ).environmentId,
    transport: remoteTransport(server.address, server.credential, fetch),
  });
  lifetimes.add(lifetime);
  return {
    connected: lifetime.connection,
    controller: lifetime.controller,
    scope: { projectId: session.projectId, worktreeId: session.worktreeId },
  };
}

const lifetimes = new Set<ReturnType<typeof createWorktreeConnection>>();
afterEach(async () => {
  for (const lifetime of lifetimes) await lifetime.close();
  lifetimes.clear();
});
