import { expect, it } from 'vite-plus/test';
import {
  beginRecovery,
  diffRecoveryStep,
  idleDiffRecovery,
  markRetried,
  recoveryPending,
  stampRead,
} from './diff-recovery.ts';

const afterReads = (count: number) => {
  let recovery = idleDiffRecovery;
  for (let read = 0; read < count; read += 1) recovery = stampRead(recovery);
  return recovery;
};
const started = beginRecovery(afterReads(2), 1);
if (!started) throw new Error('A recovery should start at an uncovered read');
const finished = { ...stampRead(started), running: false };

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
    stale: ['batch'],
    step: { kind: 'wait' },
    pending: true,
  },
  {
    situation: 'no recovery covers the read',
    recovery: idleDiffRecovery,
    read: 1,
    stale: ['batch'],
    step: { kind: 'recover' },
    pending: true,
  },
  {
    situation: 'a recovery covered the read and the batch was not retried',
    recovery: finished,
    read: 2,
    stale: ['batch'],
    step: { kind: 'retry', batches: ['batch'] },
    pending: true,
  },
  {
    situation:
      'the read was produced by the recovery and the batch was not retried',
    recovery: finished,
    read: 3,
    stale: ['batch'],
    step: { kind: 'retry', batches: ['batch'] },
    pending: true,
  },
  {
    situation: 'every stale batch was already retried after the recovery',
    recovery: markRetried(finished, ['batch']).recovery,
    read: 3,
    stale: ['batch'],
    step: { kind: 'given-up' },
    pending: false,
  },
  {
    situation: 'a later read that the recovery did not produce',
    recovery: markRetried(stampRead(stampRead(finished)), ['batch']).recovery,
    read: 5,
    stale: ['batch'],
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

it('a recovery covers every read received before it started and forgets retries from the last one', () => {
  const retried = markRetried(finished, ['batch']).recovery;
  expect(started).toMatchObject({ running: true, coveredThrough: 2 });
  expect(beginRecovery(finished, 2)).toBeUndefined();
  expect(beginRecovery(finished, 3)).toBeUndefined();
  expect(beginRecovery(stampRead(stampRead(retried)), 5)).toMatchObject({
    running: true,
    coveredThrough: 5,
    produced: [],
    retried: [],
  });
});

it('retries a batch at most once per recovery', () => {
  const first = markRetried(finished, ['a', 'b']);
  const second = markRetried(first.recovery, ['b', 'c']);
  expect([first.marked, second.marked]).toEqual([['a', 'b'], ['c']]);
});

it('records a Changes read as produced only while a recovery is running', () => {
  expect(stampRead(idleDiffRecovery).produced).toEqual([]);
  expect(finished).toMatchObject({ latestRead: 3, produced: [3] });
});
