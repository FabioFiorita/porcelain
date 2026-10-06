import { afterEach, expect, it } from 'vitest';
import { Layer, Effect } from 'effect';
import { AtomRegistry } from 'effect/reactivity';
import {
  createWorktreeConnection,
  type Transport,
} from '@porcelain/client/transport';
import { readPublishedReview, readProofFile } from './publication.ts';

const scope = { projectId: 'project', worktreeId: 'a'.repeat(32) };
const environmentId = '00000000-0000-4000-8000-000000000001';
const published = {
  environmentId,
  worktreeId: scope.worktreeId,
  revision: 3,
  publishedAt: '2026-10-05T04:00:00.000Z',
  active: true,
  diagnostics: 'current',
  summary: {
    url: '/review-summaries/summary?expires=tomorrow&signature=signed',
    byteLength: 42,
  },
  layers: [],
  notExplained: [],
  proof: { checks: [], assets: [], current: true },
};
const owned: ReturnType<typeof fixture>[] = [];
function fixture(transport: Transport) {
  const lifetime = createWorktreeConnection(
    {
      environmentId,
      transport,
      timeoutMs: 10_000,
    },
    undefined,
    Layer.empty,
  );
  const registry = AtomRegistry.make();
  const atom = readPublishedReview({ connection: lifetime.connection, scope });
  return { ...lifetime, registry, atom };
}
function query(review: object | null) {
  const subject = fixture(() => Promise.resolve(Response.json({ review })));
  owned.push(subject);
  return read(subject);
}
function read(subject: ReturnType<typeof fixture>) {
  return Effect.runPromise(
    AtomRegistry.getResult(subject.registry, subject.atom, {
      suspendOnWaiting: true,
    }),
  );
}
afterEach(async () => {
  for (const subject of owned) {
    subject.registry.dispose();
    await subject.close();
  }
  owned.length = 0;
});
it('reads the selected published review and preserves an absent review as null', async () => {
  expect(await query(published)).toEqual({
    ...published,
    summary: {
      token: 'summary',
      expires: 'tomorrow',
      signature: 'signed',
      byteLength: 42,
    },
  });
  expect(await query(null)).toBeNull();
});
it.each([
  ['worktree', { ...published, worktreeId: 'b'.repeat(32) }],
  [
    'environment',
    { ...published, environmentId: '00000000-0000-4000-8000-000000000002' },
  ],
])('refuses a published review from a different %s', async (_name, review) => {
  await expect(query(review)).rejects.toMatchObject({
    _tag: 'ConnectionError',
    message:
      'The connected context changed. Reopen Porcelain to continue safely.',
  });
});

const proofId = '11111111-1111-4111-8111-111111111111';
const file = { id: proofId, mediaType: 'image/png', base64: 'AQIDBA==' };
it('reads the selected proof attachment without altering its bytes or media type', async () => {
  const paths: string[] = [];
  const subject = fixture((path) => {
    paths.push(path);
    return Promise.resolve(Response.json(file));
  });
  owned.push(subject);
  expect(
    await Effect.runPromise(
      AtomRegistry.getResult(
        subject.registry,
        readProofFile({ connection: subject.connection, scope, proofId }),
      ),
    ),
  ).toEqual(file);
  expect(paths).toEqual([
    `/api/worktrees/${scope.worktreeId}/review/proof?proofId=${proofId}`,
  ]);
});
it('refuses an attachment returned for a different proof id', async () => {
  const subject = fixture(() =>
    Promise.resolve(
      Response.json({ ...file, id: '22222222-2222-4222-8222-222222222222' }),
    ),
  );
  owned.push(subject);
  await expect(
    Effect.runPromise(
      AtomRegistry.getResult(
        subject.registry,
        readProofFile({ connection: subject.connection, scope, proofId }),
      ),
    ),
  ).rejects.toMatchObject({
    _tag: 'ConnectionError',
    message:
      'The connected context changed. Reopen Porcelain to continue safely.',
  });
});
