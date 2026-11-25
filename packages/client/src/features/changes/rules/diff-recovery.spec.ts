import { expect, it } from 'vite-plus/test';
import {
  beginRecovery,
  claimRetry,
  diffRecoveryStep,
  finishRecovery,
  idleDiffRecovery,
  recoveryPending,
  settleRetry,
  stampRead,
  type StaleBatch,
} from './diff-recovery.ts';

const snapshot = (statusToken: string, fingerprint: string) => ({
  statusToken,
  fingerprints: new Map([['README.md', fingerprint]]),
});
const original = snapshot('a', 'c');
const edited = snapshot('a', 'd');
const afterReads = (count: number) => {
  let recovery = idleDiffRecovery;
  for (let read = 0; read < count; read += 1)
    recovery = stampRead(recovery, original);
  return recovery;
};
const started = beginRecovery(afterReads(2), 1);
if (!started) throw new Error('A recovery should start at an uncovered read');
const finished = { ...stampRead(started, original), running: false };
const ticket = { generation: 1, read: 3 };
const batch = (overrides: Partial<StaleBatch> = {}): StaleBatch => ({
  key: 'batch',
  statusToken: 'a',
  expectedFiles: [{ path: 'README.md', fingerprint: 'c' }],
  waiting: false,
  ...overrides,
});
const claimed = claimRetry(finished, ticket, ['batch']).recovery;

it.each([
  {
    situation: 'nothing failed as stale',
    recovery: idleDiffRecovery,
    read: 1,
    stale: [],
    step: { kind: 'idle' },
    pending: false,
  },
  {
    situation: 'a recovery is running',
    recovery: started,
    read: 2,
    stale: [batch()],
    step: { kind: 'wait' },
    pending: true,
  },
  {
    situation: 'a stale batch is being read again',
    recovery: idleDiffRecovery,
    read: 1,
    stale: [batch({ waiting: true })],
    step: { kind: 'wait' },
    pending: true,
  },
  {
    situation: 'its automatic retry has not answered yet',
    recovery: claimed,
    read: 3,
    stale: [batch()],
    step: { kind: 'wait' },
    pending: true,
  },
  {
    situation: 'no recovery covers the read',
    recovery: idleDiffRecovery,
    read: 1,
    stale: [batch()],
    step: { kind: 'recover' },
    pending: true,
  },
  {
    situation: 'a recovery covered the read and the batch was not retried',
    recovery: finished,
    read: 2,
    stale: [batch()],
    step: { kind: 'retry', batches: ['batch'], ticket },
    pending: true,
  },
  {
    situation:
      'the read was produced by the recovery and the batch was not retried',
    recovery: finished,
    read: 3,
    stale: [batch()],
    step: { kind: 'retry', batches: ['batch'], ticket },
    pending: true,
  },
  {
    situation: 'the refresh shows other contents than an older read',
    recovery: { ...stampRead(started, edited), running: false },
    read: 2,
    stale: [batch()],
    step: { kind: 'superseded' },
    pending: true,
  },
  {
    situation: 'the refresh shows another status than an older read',
    recovery: {
      ...stampRead(started, snapshot('b', 'c')),
      running: false,
    },
    read: 2,
    stale: [batch()],
    step: { kind: 'superseded' },
    pending: true,
  },
  {
    situation: 'the recovery covering the read ended without a new snapshot',
    recovery: finishRecovery(started),
    read: 2,
    stale: [batch()],
    step: { kind: 'given-up' },
    pending: false,
  },
  {
    situation: 'every stale batch was already retried after the recovery',
    recovery: settleRetry(claimed, ticket, 'batch'),
    read: 3,
    stale: [batch()],
    step: { kind: 'given-up' },
    pending: false,
  },
  {
    situation: 'a later read that the recovery did not produce',
    recovery: stampRead(
      stampRead(settleRetry(claimed, ticket, 'batch'), original),
      original,
    ),
    read: 5,
    stale: [batch()],
    step: { kind: 'recover' },
    pending: true,
  },
])(
  'when $situation, a window $step.kind',
  ({ recovery, read, stale, step, pending }) => {
    const next = diffRecoveryStep(recovery, read, stale);
    expect(next).toEqual(step);
    expect(recoveryPending(next)).toBe(pending);
  },
);

it('retries only the batches the refresh did not supersede', () => {
  const recovery = { ...stampRead(started, edited), running: false };
  const current = batch({
    key: 'current',
    expectedFiles: [{ path: 'README.md', fingerprint: 'd' }],
  });
  expect(diffRecoveryStep(recovery, 2, [batch(), current])).toEqual({
    kind: 'retry',
    batches: ['current'],
    ticket: { generation: 1, read: 3 },
  });
});

it('a recovery covers every read received before it started and forgets retries from the last one', () => {
  expect(started).toMatchObject({
    running: true,
    coveredThrough: 2,
    generation: 1,
  });
  expect(beginRecovery(finished, 2)).toBeUndefined();
  expect(beginRecovery(finished, 3)).toBeUndefined();
  expect(
    beginRecovery(stampRead(stampRead(claimed, original), original), 5),
  ).toMatchObject({
    running: true,
    coveredThrough: 5,
    generation: 2,
    produced: [],
    retried: [],
    inFlight: [],
  });
});

it('retries a batch at most once per recovery', () => {
  const first = claimRetry(finished, ticket, ['a', 'b']);
  const second = claimRetry(first.recovery, ticket, ['b', 'c']);
  expect([first.marked, second.marked]).toEqual([['a', 'b'], ['c']]);
});

it.each([
  { situation: 'a newer recovery is running', recovery: started },
  {
    situation: 'a newer recovery has finished',
    recovery: {
      ...stampRead(
        beginRecovery(stampRead(finished, original), 4) ?? finished,
        original,
      ),
      running: false,
    },
  },
  {
    situation: 'a newer Changes read arrived',
    recovery: stampRead(finished, original),
  },
])('refuses a retry authorized before $situation', ({ recovery }) => {
  expect(claimRetry(recovery, ticket, ['batch']).marked).toEqual([]);
});

it('refuses a retry from a recovery that ended without a new snapshot', () => {
  const failed = finishRecovery(started);
  expect(
    claimRetry(failed, { generation: 1, read: failed.latestRead }, ['batch'])
      .marked,
  ).toEqual([]);
});

it('settles an automatic retry only for the recovery that claimed it', () => {
  expect(settleRetry(claimed, ticket, 'batch').inFlight).toEqual([]);
  expect(
    settleRetry(claimed, { generation: 2, read: 3 }, 'batch').inFlight,
  ).toEqual(['batch']);
});

it('records a Changes read and its contents, and marks it produced only while a recovery is running', () => {
  expect(stampRead(idleDiffRecovery, edited)).toMatchObject({
    latestRead: 1,
    snapshot: edited,
    produced: [],
  });
  expect(finished).toMatchObject({ latestRead: 3, produced: [3] });
});
