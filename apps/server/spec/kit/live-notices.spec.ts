import { expect, test } from 'vitest';
import { liveNotices } from './live-notices.ts';
import { record, type LiveConnection } from './session.ts';

const receipt = {
  type: 'git-action',
  receipt: { requestId: 'first', state: 'succeeded' },
};
const changed = { type: 'worktree', change: 'git' };
const secondReceipt = {
  type: 'git-action',
  receipt: { requestId: 'second', state: 'succeeded' },
};
const succeeded = (requestId: string) => (notice: Record<string, unknown>) =>
  notice.type === 'git-action' &&
  record(notice.receipt).requestId === requestId &&
  record(notice.receipt).state === 'succeeded';
const gitChanged = (notice: Record<string, unknown>) =>
  notice.type === 'worktree' && notice.change === 'git';

function consumingConnection(notices: readonly Record<string, unknown>[]) {
  const pending = [...notices];
  return {
    async next(accept) {
      while (pending.length > 0) {
        const notice = pending.shift();
        if (notice && accept(notice)) return notice;
      }
      throw new Error('No further live notices');
    },
  } satisfies Pick<LiveConnection, 'next'>;
}

test.each([
  { state: 'receipt before Git change', notices: [receipt, changed] },
  { state: 'Git change before receipt', notices: [changed, receipt] },
  {
    state: 'coalesced Git change before multiple receipts',
    notices: [changed, secondReceipt, receipt],
  },
  {
    state: 'duplicate Git changes before receipt',
    notices: [changed, changed, receipt],
  },
  ...['running', 'no-change', 'rejected', 'conflicted', 'interrupted'].map(
    (state) => ({
      state: `a ${state} receipt does not satisfy success`,
      notices: [
        { type: 'git-action', receipt: { requestId: 'first', state } },
        changed,
        receipt,
      ],
    }),
  ),
  ...[
    { type: 'ready' },
    { type: 'subscribed' },
    { type: 'heartbeat' },
    { type: 'inventory' },
    ...['files', 'preferences'].map((change) => ({ type: 'project', change })),
    ...['files', 'reviewed', 'comments', 'review'].map((change) => ({
      type: 'worktree',
      change,
    })),
    secondReceipt,
  ].map((notice) => ({
    state: `unrelated notice ${JSON.stringify(notice)}`,
    notices: [notice, changed, receipt],
  })),
])('observes both notices: $state', async ({ notices }) => {
  expect(
    await liveNotices(consumingConnection(notices), [
      succeeded('first'),
      gitChanged,
    ]),
  ).toEqual([receipt, changed]);
});

test('two actions back to back retain both receipts and a shared Git invalidation', async () => {
  expect(
    await liveNotices(consumingConnection([secondReceipt, changed, receipt]), [
      succeeded('first'),
      succeeded('second'),
      gitChanged,
    ]),
  ).toEqual([receipt, secondReceipt, changed]);
});

test.each([
  { state: 'empty stream', notices: [] },
  { state: 'missing receipt', notices: [changed] },
  { state: 'missing Git change', notices: [receipt] },
  {
    state: 'only another request succeeded',
    notices: [secondReceipt, changed],
  },
])('fails when a required notice is absent: $state', async ({ notices }) => {
  await expect(
    liveNotices(consumingConnection(notices), [succeeded('first'), gitChanged]),
  ).rejects.toThrow('No further live notices');
});

test('no expectations need no notices', async () => {
  expect(await liveNotices(consumingConnection([]), [])).toEqual([]);
});

test.each(['Timed out waiting for a live notice', 'The live server is down'])(
  'propagates a live failure: %s',
  async (message) => {
    await expect(
      liveNotices(
        {
          next: () => Promise.reject(new Error(message)),
        },
        [gitChanged],
      ),
    ).rejects.toThrow(message);
  },
);
