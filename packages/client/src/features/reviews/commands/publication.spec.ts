import { Effect } from 'effect';
import { type Atom, type AsyncResult, AtomRegistry } from 'effect/reactivity';
import { expect, it } from 'vitest';
import { clientFixtures } from '../../../../spec/kit/client-fixture.ts';
import { readLayerMarks, readPublishedReview } from '../queries/publication.ts';
import { deleteReview } from './publication.ts';

const environmentId = '00000000-0000-4000-8000-000000000001';
const fixture = clientFixtures(environmentId);
const scope = { projectId: 'project', worktreeId: 'a'.repeat(32) };
const review = {
  environmentId,
  worktreeId: scope.worktreeId,
  revision: 1,
  publishedAt: '2026-10-11T10:00:00.000Z',
  active: true,
  diagnostics: 'current',
  summary: {
    url: '/review-summaries/token?expires=tomorrow&signature=signed',
    byteLength: 5,
  },
  layers: [],
  notExplained: [],
  proof: { checks: [], assets: [], current: true },
};

it('deletes over HTTP and refreshes the mounted review and reviewed layers to their empty states', async () => {
  let deleted = false;
  const requests: string[] = [];
  const subject = fixture((path, init) => {
    requests.push(`${init?.method ?? 'GET'} ${path}`);
    if (init?.method === 'DELETE') {
      deleted = true;
      return Promise.resolve(Response.json({ deleted: true }));
    }
    return Promise.resolve(
      Response.json(
        path.includes('reviewed-layers')
          ? {
              worktreeId: scope.worktreeId,
              marks: deleted
                ? []
                : [
                    {
                      layerId: '11111111-1111-4111-8111-111111111111',
                      fingerprint: 'f'.repeat(64),
                      stale: false,
                      reviewedAt: '2026-10-11T10:00:00.000Z',
                    },
                  ],
            }
          : { review: deleted ? null : review },
      ),
    );
  });
  const input = { scope, connection: subject.connection };
  const publication = readPublishedReview(input);
  const marks = readLayerMarks(input);
  subject.registry.mount(publication);
  subject.registry.mount(marks);
  const read = <A, E>(atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>) =>
    Effect.runPromise(
      AtomRegistry.getResult(subject.registry, atom, {
        suspendOnWaiting: true,
      }),
    );
  expect((await read(publication))?.revision).toBe(1);
  expect((await read(marks)).marks).toHaveLength(1);
  const command = deleteReview(input);
  subject.registry.set(command, undefined);
  expect(await read(command)).toEqual({ deleted: true });
  expect(await read(publication)).toBeNull();
  expect((await read(marks)).marks).toEqual([]);
  expect(requests).toContain(
    `DELETE /api/worktrees/${scope.worktreeId}/review`,
  );
});
