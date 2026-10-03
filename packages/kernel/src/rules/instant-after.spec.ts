import { describe, expect, it } from 'vitest';
import { instantAfter } from './instant-after.ts';

describe('instantAfter', () => {
  it('answers the ISO instant a lifetime after the start', () => {
    expect(instantAfter('2026-01-01T00:00:00.000Z', 900_000)).toBe(
      '2026-01-01T00:15:00.000Z',
    );
  });

  it('carries across days and normalises the start to UTC', () => {
    expect(instantAfter('2026-12-31T23:59:59.999+00:00', 1)).toBe(
      '2027-01-01T00:00:00.000Z',
    );
    expect(instantAfter('2026-01-01T02:00:00.000+02:00', 0)).toBe(
      '2026-01-01T00:00:00.000Z',
    );
  });
});
