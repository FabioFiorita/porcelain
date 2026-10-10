import { unreachableClientFixture } from '../../../../spec/kit/client-fixture.ts';
import { Effect } from 'effect';
import { AtomRegistry } from 'effect/reactivity';
import { expect, it } from 'vitest';
import { ConnectionError } from '@porcelain/client/transport';
import { readCommitModels } from './git-actions.ts';

const fixture = unreachableClientFixture();

it('reports an unreachable server as a connection failure for commit models', async () => {
  const { connection, registry, sent, failure } = fixture();
  const error = await Effect.runPromise(
    Effect.flip(AtomRegistry.getResult(registry, readCommitModels(connection))),
  );
  expect(error).toBeInstanceOf(ConnectionError);
  expect(error).toMatchObject({ cause: failure });
  expect(sent).toEqual(['/api/git/commit-models']);
});
