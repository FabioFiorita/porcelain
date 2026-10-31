import { afterEach, expect, it } from 'vitest';
import { visitClientRead } from '../../../../spec/kit/client-fixture.ts';
import { HashMap, Layer, Effect, Option } from 'effect';
import { AsyncResult, AtomRegistry } from 'effect/reactivity';
import {
  createWorktreeConnection,
  type Transport,
} from '@porcelain/client/transport';
import {
  readPublishedReview,
  readProofFile,
  readReviewSummary,
} from './publication.ts';
import { ReadSubscriptions } from '../../../shared/api/read-subscriptions.ts';
import { reviewSummaryUrl } from '../rules/review.ts';
import type { SummaryDelivery } from '../api.ts';

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
it('shows a visited publication while revalidating without retaining its live subscription', async () => {
  let requests = 0;
  const held = Promise.withResolvers<Response>();
  const started = Promise.withResolvers<void>();
  const subject = fixture(() => {
    if (++requests === 2) {
      started.resolve();
      return held.promise;
    }
    return Promise.resolve(Response.json({ review: published }));
  });
  owned.push(subject);
  expect(
    (await visitClientRead(subject.registry, subject.atom))?.revision,
  ).toBe(3);
  expect(
    HashMap.size(
      await subject.connection.runtime.runPromise(
        ReadSubscriptions.use((reads) => reads.snapshot),
      ),
    ),
  ).toBe(0);
  const back = subject.registry.mount(subject.atom);
  await started.promise;
  const visible = subject.registry.get(subject.atom);
  expect(AsyncResult.isInitial(visible)).toBe(false);
  expect(Option.getOrThrow(AsyncResult.value(visible))?.revision).toBe(3);
  expect(visible.waiting).toBe(true);
  held.resolve(Response.json({ review: { ...published, revision: 4 } }));
  expect((await read(subject))?.revision).toBe(4);
  expect(requests).toBe(2);
  back();
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

const summaryCapability = {
  token: proofId,
  expires: '2026-10-15T23:00:00.000Z',
  signature: 's'.repeat(43),
};

function readSummary(
  subject: ReturnType<typeof fixture>,
  summary: typeof summaryCapability & { byteLength: number },
  delivery?: SummaryDelivery,
) {
  return Effect.runPromise(
    AtomRegistry.getResult(
      subject.registry,
      readReviewSummary({
        connection: subject.connection,
        scope,
        summary,
        ...(delivery ? { delivery } : {}),
      }),
      { suspendOnWaiting: true },
    ),
  );
}

it('reads the exact published summary HTML through the selected connection and signed capability', async () => {
  const paths: string[] = [];
  const html = '<style>h1{color:navy}</style><h1>Dispatch decisions</h1>';
  const subject = fixture((path) => {
    paths.push(path);
    return Promise.resolve(
      new Response(html, {
        headers: { 'content-type': 'text/html; charset=utf-8' },
      }),
    );
  });
  owned.push(subject);
  const summary = {
    ...summaryCapability,
    byteLength: html.length,
  };
  expect(await readSummary(subject, summary)).toBe(html);
  expect(paths).toEqual([
    `/review-summaries/${proofId}?expires=2026-10-15T23%3A00%3A00.000Z&signature=${'s'.repeat(43)}`,
  ]);
});
it('reuses immutable summary HTML across rotated signed links while keeping publications separate', async () => {
  const paths: string[] = [];
  const subject = fixture((path) => {
    paths.push(path);
    return Promise.resolve(
      new Response(
        path.includes(proofId) ? '<h1>First</h1>' : '<h1>Second</h1>',
      ),
    );
  });
  owned.push(subject);
  const summary = { ...summaryCapability, byteLength: 14 };
  const atom = readReviewSummary({
    connection: subject.connection,
    scope,
    summary,
  });
  const stop = subject.registry.mount(atom);
  expect(await readSummary(subject, summary)).toBe('<h1>First</h1>');
  stop();
  await Effect.runPromise(Effect.yieldNow);
  expect(await readSummary(subject, summary)).toBe('<h1>First</h1>');
  const rotated = readReviewSummary({
    connection: subject.connection,
    scope,
    summary: {
      ...summary,
      expires: '2026-10-16T23:00:00.000Z',
      signature: 'r'.repeat(43),
    },
    delivery: {
      url: 'https://proxy.test/rotated',
      transport: () =>
        Promise.reject(
          new Error('A rotated link must reuse the immutable HTML'),
        ),
    },
  });
  const visible = subject.registry.get(rotated);
  expect(AsyncResult.isSuccess(visible)).toBe(true);
  expect(Option.getOrThrow(AsyncResult.value(visible))).toBe('<h1>First</h1>');
  expect(
    await readSummary(subject, {
      ...summary,
      token: '22222222-2222-4222-8222-222222222222',
    }),
  ).toBe('<h1>Second</h1>');
  expect(paths).toHaveLength(2);
});

it('reads a remote signed summary through the public app proxy without using the authenticated remote transport', async () => {
  const paths: string[] = [];
  const html = '<h1>Remote summary</h1>';
  const subject = fixture(() =>
    Promise.reject(
      new Error('The remote summary endpoint does not allow CORS'),
    ),
  );
  owned.push(subject);
  const summary = {
    ...summaryCapability,
    byteLength: html.length,
  };
  expect(
    await readSummary(subject, summary, {
      url: reviewSummaryUrl(summary, 'https://remote.test', 'porcelain://app'),
      transport: (path, init) => {
        paths.push(path);
        expect(new Headers(init?.headers).has('authorization')).toBe(false);
        return Promise.resolve(new Response(html));
      },
    }),
  ).toBe(html);
  expect(paths).toEqual([
    `porcelain://app/remote-review-summaries/${proofId}?computer=https%3A%2F%2Fremote.test&expires=2026-10-15T23%3A00%3A00.000Z&signature=${'s'.repeat(43)}`,
  ]);
});
