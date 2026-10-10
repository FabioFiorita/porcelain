import { unreachableClientFixture } from '../../../../spec/kit/client-fixture.ts';
import { Effect } from 'effect';
import { AtomRegistry } from 'effect/reactivity';
import { expect, it } from 'vitest';
import { ConnectionError } from '@porcelain/client/transport';
import { readProjectFolder } from './folders.ts';

const fixture = unreachableClientFixture();

it('reports an unreachable server as a connection failure for the browsed folder', async () => {
  const { connection, registry, sent, failure } = fixture();
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
