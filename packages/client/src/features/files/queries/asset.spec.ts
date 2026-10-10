import { clientFixtures } from '../../../../spec/kit/client-fixture.ts';
import { expect, it } from 'vitest';
import { Effect } from 'effect';
import { AtomRegistry } from 'effect/reactivity';
import { type Transport } from '@porcelain/client/transport';

const scope = {
  projectId: 'project',
  worktreeId: '00000000000000000000000000000000',
};
const fixture = clientFixtures('environment');

import { readAsset } from './asset.ts';
const image = {
  path: 'image #1.png',
  mediaType: 'image/png',
  base64: 'aGVsbG8=',
};
it('shares an active asset read, isolates replacement credentials and encodes the path once', async () => {
  const sent: string[] = [];
  const transport: Transport = (path) => {
    sent.push(path);
    return Promise.resolve(Response.json(image));
  };
  const first = fixture(transport, ['paired-device-1']);
  const second = fixture(transport, ['paired-device-2']);
  const query = readAsset({
    connection: first.connection,
    scope,
    path: image.path,
  });
  const stop = first.registry.mount(query);
  try {
    expect(
      await Effect.runPromise(AtomRegistry.getResult(first.registry, query)),
    ).toEqual(image);
    expect(
      await Effect.runPromise(
        AtomRegistry.getResult(
          first.registry,
          readAsset({ connection: first.connection, scope, path: image.path }),
        ),
      ),
    ).toEqual(image);
    expect(
      await Effect.runPromise(
        AtomRegistry.getResult(
          second.registry,
          readAsset({ connection: second.connection, scope, path: image.path }),
        ),
      ),
    ).toEqual(image);
    expect(sent).toEqual([
      `/api/worktrees/${scope.worktreeId}/asset?path=image+%231.png`,
      `/api/worktrees/${scope.worktreeId}/asset?path=image+%231.png`,
    ]);
  } finally {
    stop();
  }
});
