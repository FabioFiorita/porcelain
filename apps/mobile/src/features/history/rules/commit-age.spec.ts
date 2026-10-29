import { expect, test } from 'vitest';
import { commitAge } from './commit-age';

const now = Date.parse('2026-10-28T12:00:00Z');

test.each([
  ['2026-10-28T12:00:00Z', '0 seconds ago'],
  ['not-a-date', 'Unknown time'],
  ['2026-10-28T11:59:45Z', '15 seconds ago'],
  ['2026-10-28T11:58:00Z', '2 minutes ago'],
  ['2026-10-28T10:00:00Z', '2 hours ago'],
  ['2026-10-26T12:00:00Z', '2 days ago'],
  ['2026-08-29T12:00:00Z', '2 months ago'],
  ['2024-10-28T12:00:00Z', '2 years ago'],
  ['2026-10-28T12:02:00Z', 'in 2 minutes'],
])('formats %s as %s', (timestamp, expected) => {
  expect(commitAge(timestamp, now)).toBe(expected);
});
