import { expect, it } from 'vitest';
import { publishedReviewQueryOptions } from './published-review.ts';

const scope = { projectId: 'project', worktreeId: 'a'.repeat(32) };
const environmentId = '00000000-0000-4000-8000-000000000001';
const signal = new AbortController().signal;
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
function query(review: object | null, lifetime = signal) {
  return publishedReviewQueryOptions(scope, {
    environmentId,
    request: (caller?: AbortSignal) => ({
      signal: caller ? AbortSignal.any([caller, lifetime]) : lifetime,
    }),
    transport: () => Promise.resolve(Response.json({ review })),
  });
}
it('reads the selected published review and preserves an absent review as null', async () => {
  expect(await query(published).queryFn({ signal })).toEqual({
    ...published,
    summary: {
      token: 'summary',
      expires: 'tomorrow',
      signature: 'signed',
      byteLength: 42,
    },
  });
  expect(await query(null).queryFn({ signal })).toBeNull();
});
it.each([
  ['worktree', { ...published, worktreeId: 'b'.repeat(32) }],
  [
    'environment',
    { ...published, environmentId: '00000000-0000-4000-8000-000000000002' },
  ],
])('refuses a published review from a different %s', async (_name, review) => {
  await expect(query(review).queryFn({ signal })).rejects.toThrow(
    'The connected context changed. Reopen Porcelain to continue safely.',
  );
});
