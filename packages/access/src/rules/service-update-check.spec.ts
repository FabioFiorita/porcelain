import { describe, expect, it } from 'vitest';
import { serviceUpdateCheck } from './service-update-check.ts';

describe('serviceUpdateCheck', () => {
  it('treats a published version read before the window as stale', () => {
    expect(serviceUpdateCheck('2026-09-29T12:10:00.000Z', 600_000)).toEqual({
      now: '2026-09-29T12:10:00.000Z',
      staleBefore: '2026-09-29T12:00:00.000Z',
    });
  });
});
