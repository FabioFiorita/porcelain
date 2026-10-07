import { Effect, Layer } from 'effect';
import { AtomRegistry } from 'effect/reactivity';
import { afterEach, expect, it } from 'vitest';
import {
  ConnectionError,
  createWorktreeConnection,
} from '@porcelain/client/transport';
import { readProjectFolder } from './folders.ts';

const owned: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of owned) await close();
  owned.length = 0;
});

it('reports an unreachable server as a connection failure for the browsed folder', async () => {
  const sent: string[] = [];
  const failure = new TypeError('Network request failed');
  const { connection, close } = createWorktreeConnection(
    {
      environmentId: 'environment',
      timeoutMs: 10_000,
      transport: (path) => {
        sent.push(path);
        return Promise.reject(failure);
      },
    },
    undefined,
    Layer.empty,
  );
  const registry = AtomRegistry.make();
  owned.push(async () => {
    registry.dispose();
    await close();
  });
  const error = await Effect.runPromise(
    Effect.flip(
      AtomRegistry.getResult(
        registry,
        readProjectFolder(connection, '/work/a b'),
      ),
    ),
  );
  expect(error).toBeInstanceOf(ConnectionError);
  expect(error).toMatchObject({
    message: 'Could not reach Porcelain. Try again.',
    cause: failure,
  });
  expect(sent).toEqual(['/api/projects/folders?path=%2Fwork%2Fa+b']);
});
