import { expect, it } from 'vite-plus/test';
import { relativeTime } from './relative-time.ts';

const now = Date.parse('2026-11-26T12:00:00.000Z');

it('writes every age in one short format', () => {
  expect(relativeTime('2026-11-26T11:59:11.000Z', now)).toBe('49s ago');
  expect(relativeTime('2026-11-26T11:57:00.000Z', now)).toBe('3m ago');
  expect(relativeTime('2026-11-26T09:00:00.000Z', now)).toBe('3h ago');
  expect(relativeTime('2026-11-24T12:00:00.000Z', now)).toBe('2d ago');
  expect(relativeTime('2026-09-26T12:00:00.000Z', now)).toBe('2mo ago');
  expect(relativeTime('2024-11-26T12:00:00.000Z', now)).toBe('2y ago');
  expect(relativeTime('2026-11-26T12:05:00.000Z', now)).toBe('in 5m');
});
