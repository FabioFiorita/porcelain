import { Effect, Layer, Redacted, Schema } from 'effect';
import { AtomRegistry, type Atom, type AsyncResult } from 'effect/reactivity';
import { afterEach } from 'vitest';
import { createWorktreeConnection } from '../../src/shared/api/worktree-connection.ts';
import { remoteTransport } from '../../src/shared/api/transport.ts';
import type { IsolatedServer } from '@porcelain/server/kit/isolated-server';
import type { Session } from '@porcelain/server/kit/session';
import { inventory } from '@porcelain/server/kit/reads';
import { readInventoryResponseSchema } from '@porcelain/contracts/projects';

export async function connection(server: IsolatedServer, session: Session) {
  const lifetime = createWorktreeConnection(
    {
      timeoutMs: 15_000,
      environmentId: Schema.decodeUnknownSync(readInventoryResponseSchema)(
        await inventory(session),
      ).environmentId,
      transport: remoteTransport(
        server.address,
        Redacted.make(server.credential),
        fetch,
      ),
    },
    undefined,
    Layer.empty,
  );
  const registry = AtomRegistry.make();
  lifetimes.add({ lifetime, registry });
  return {
    connected: lifetime.connection,
    scope: { projectId: session.projectId, worktreeId: session.worktreeId },
    registry,
    execute: <Input, A, E>(
      atom: Atom.AtomResultFn<Input, A, E>,
      input: Input,
    ) => {
      registry.set(atom, input);
      return Effect.runPromise(
        AtomRegistry.getResult(registry, atom, { suspendOnWaiting: true }),
      );
    },
    read: <A, E>(atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>) =>
      Effect.runPromise(
        AtomRegistry.getResult(registry, atom, { suspendOnWaiting: true }),
      ),
  };
}

const lifetimes = new Set<{
  lifetime: ReturnType<typeof createWorktreeConnection<never>>;
  registry: AtomRegistry.AtomRegistry;
}>();
afterEach(async () => {
  for (const { lifetime, registry } of lifetimes) {
    registry.dispose();
    await lifetime.close();
  }
  lifetimes.clear();
});
