import { expect, it } from 'vitest';
import { requestedRead } from './requested-read';

const settled = { waiting: false, failed: false };
const failing = { waiting: false, failed: true };
const waiting = { waiting: true, failed: false };

it('reports a failure only for the read the person started', () => {
  expect(requestedRead('requested', waiting)).toBe('reading');
  expect(requestedRead('reading', failing)).toBe('failed');
  expect(requestedRead('idle', failing)).toBe('idle');
  expect(requestedRead('idle', waiting)).toBe('idle');
});

it('forgets the request once it settles, so a later background failure stays quiet', () => {
  const afterSuccess = requestedRead('reading', settled);
  expect(afterSuccess).toBe('idle');
  expect(requestedRead(afterSuccess, waiting)).toBe('idle');
  expect(requestedRead(afterSuccess, failing)).toBe('idle');
});

it('waits for the requested read to start before judging it', () => {
  expect(requestedRead('requested', failing)).toBe('requested');
  expect(requestedRead('failed', settled)).toBe('idle');
});
