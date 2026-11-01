import { DateTime } from 'effect';
import { expect, test } from 'vitest';
import { commitAge } from './commit-age';

const now = DateTime.makeUnsafe('2026-11-01T12:00:00Z');

test.each([
  ['2026-11-01T12:00:00Z', '0 seconds ago'],
  ['2026-11-01T11:59:45Z', '15 seconds ago'],
  ['2026-11-01T11:59:00Z', '1 minute ago'],
  ['2026-11-01T11:58:00Z', '2 minutes ago'],
  ['2026-11-01T10:00:00Z', '2 hours ago'],
  ['2026-10-30T12:00:00Z', '2 days ago'],
  ['2026-09-02T12:00:00Z', '2 months ago'],
  ['2025-11-03T12:00:00Z', '1 year ago'],
  ['2024-11-01T12:00:00Z', '2 years ago'],
  ['2026-11-01T12:02:00Z', 'in 2 minutes'],
  ['not-a-date', 'Unknown time'],
])('shows %s as %s relative to a fixed instant', (timestamp, expected) => {
  expect(commitAge(timestamp, now)).toBe(expected);
});
