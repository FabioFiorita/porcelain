import { expect, it } from 'vite-plus/test';
import { idleRead, requestRead, requestedRead } from './requested-read';

const before = { status: 'before' };
const after = { status: 'after' };
const settled = { waiting: false, failed: false, current: [after] };
const failing = { waiting: false, failed: true, current: [after] };
const waiting = { waiting: true, failed: false, current: [after] };

it('reports a failure only for the read the person started', () => {
  const reading = requestedRead(requestRead([before]), waiting);
  expect(reading).toEqual({ kind: 'reading' });
  expect(requestedRead(reading, failing)).toEqual({ kind: 'failed' });
  expect(requestedRead(idleRead, failing)).toBe(idleRead);
  expect(requestedRead(idleRead, waiting)).toBe(idleRead);
});

it('forgets the request once it settles, so a later background failure stays quiet', () => {
  const afterSuccess = requestedRead({ kind: 'reading' }, settled);
  expect(afterSuccess).toBe(idleRead);
  expect(requestedRead(afterSuccess, waiting)).toBe(idleRead);
  expect(requestedRead(afterSuccess, failing)).toBe(idleRead);
});

it('judges a request that settled before its pending state was seen', () => {
  expect(requestedRead(requestRead([before]), failing)).toEqual({
    kind: 'failed',
  });
  expect(requestedRead(requestRead([before]), settled)).toBe(idleRead);
});

it('keeps waiting while the read has not changed yet', () => {
  const requested = requestRead([before]);
  expect(
    requestedRead(requested, {
      waiting: false,
      failed: true,
      current: [before],
    }),
  ).toBe(requested);
  expect(requestedRead({ kind: 'failed' }, settled)).toBe(idleRead);
});
